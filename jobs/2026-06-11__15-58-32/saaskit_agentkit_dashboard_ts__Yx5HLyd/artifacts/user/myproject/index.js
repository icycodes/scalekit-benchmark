'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ---------------------------------------------------------------------------
// Scalekit client – credentials come from environment variables only
// ---------------------------------------------------------------------------
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const GITHUB_CONNECTION = 'github-test';
const AGENTKIT_IDENTIFIER = 'zealt-user01';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode the payload of a JWT without verifying the signature.
 * Returns the parsed JSON object or null on failure.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // Base64url → base64 → Buffer → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Minimal HTML wrapper */
function html(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; background: #f5f7fa; }
    h1 { color: #16213e; }
    a.btn, button.btn {
      display: inline-block; padding: 10px 24px; background: #0f3460; color: #fff;
      text-decoration: none; border-radius: 6px; font-size: 1rem; border: none; cursor: pointer;
    }
    a.btn:hover, button.btn:hover { background: #e94560; }
    ul { list-style: none; padding: 0; }
    li { padding: 8px 0; border-bottom: 1px solid #dde1e7; }
    li:last-child { border-bottom: none; }
    .repo-link { color: #0f3460; text-decoration: none; font-weight: 500; }
    .repo-link:hover { text-decoration: underline; }
    .info-box { background: #fff; border-radius: 8px; padding: 20px; margin: 16px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .email-badge { display: inline-block; background: #e8f4fd; color: #0f3460; padding: 4px 12px; border-radius: 20px; font-weight: 600; }
    .logout-link { color: #e94560; text-decoration: none; font-weight: 500; }
    .logout-link:hover { text-decoration: underline; }
    .goodbye { text-align: center; padding: 60px 20px; }
    .goodbye h1 { font-size: 2.5rem; color: #e94560; }
    .goodbye p { font-size: 1.2rem; color: #555; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cookieParser());

// ---------------------------------------------------------------------------
// GET / — public landing page
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).send(html('Welcome', `
    <div class="info-box">
      <h1>Welcome to the App</h1>
      <p>This app integrates Scalekit SaaSKit (authentication) and AgentKit (GitHub access).</p>
      <p>Sign in to view your connected GitHub repositories.</p>
      <a href="/login" class="btn">Sign in</a>
    </div>
  `));
});

// ---------------------------------------------------------------------------
// GET /login — build Scalekit authorize URL and redirect
// ---------------------------------------------------------------------------
app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: SCOPES,
  });
  res.redirect(302, authUrl);
});

// ---------------------------------------------------------------------------
// GET /callback — exchange code for tokens, store in HttpOnly cookies
// ---------------------------------------------------------------------------
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(html('Authentication Error', `
      <div class="info-box">
        <h1>Authentication Error</h1>
        <p><strong>${error}</strong>: ${error_description || 'Unknown error'}</p>
        <a href="/login" class="btn">Try again</a>
      </div>
    `));
  }

  if (!code) {
    return res.redirect(302, '/login');
  }

  try {
    const result = await scalekit.authenticateWithCode(String(code), REDIRECT_URI);

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    };

    res.cookie('accessToken', result.accessToken, cookieOptions);
    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.cookie('idToken', result.idToken, cookieOptions);

    return res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('Callback error:', err);
    return res.status(500).send(html('Error', `
      <div class="info-box">
        <h1>Authentication Failed</h1>
        <p>${err.message || 'An unexpected error occurred.'}</p>
        <a href="/login" class="btn">Try again</a>
      </div>
    `));
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard — protected; shows email + GitHub repos via AgentKit
// ---------------------------------------------------------------------------
app.get('/dashboard', async (req, res) => {
  const { idToken } = req.cookies;

  // Guard: no session → redirect to login
  if (!idToken) {
    return res.redirect(302, '/login');
  }

  // Decode email from idToken (no signature verification needed here)
  const claims = decodeJwtPayload(idToken);
  const email = claims && claims.email ? claims.email : '(unknown)';

  // -------------------------------------------------------------------
  // Discover the GitHub "list repos" tool name via listScopedTools,
  // then execute it via AgentKit's executeTool.
  // -------------------------------------------------------------------
  let repos = [];
  let toolError = null;

  try {
    // Step 1: List scoped tools for github-test / zealt-user01
    const scopedTools = await scalekit.tools.listScopedTools(AGENTKIT_IDENTIFIER, {
      filter: { connectors: [GITHUB_CONNECTION] },
      pageSize: 100,
    });

    // Step 2: Find the tool that lists repositories for the authenticated user
    const tools = scopedTools.tools || [];
    const listRepoTool = tools.find(
      (t) =>
        /list.*repo/i.test(t.name) ||
        /repo.*list/i.test(t.name) ||
        /list_repos_for_auth/i.test(t.name) ||
        /repos_for_authenticated/i.test(t.name) ||
        t.name === 'list-repos-for-the-authenticated-user' ||
        t.name === 'list_repos_for_the_authenticated_user' ||
        /authenticated.*user/i.test(t.name)
    );

    const toolName = listRepoTool
      ? listRepoTool.name
      : 'list-repos-for-the-authenticated-user'; // reasonable fallback

    console.log(`[dashboard] Using tool: ${toolName}`);

    // Step 3: Execute the tool
    const execResult = await scalekit.tools.executeTool({
      toolName,
      connector: GITHUB_CONNECTION,
      identifier: AGENTKIT_IDENTIFIER,
      params: { per_page: 30 },
    });

    // Step 4: Parse the response
    // executeTool returns ExecuteToolResponse; the actual payload is in .result
    // which is a JSON string or object depending on SDK version
    const rawResult = execResult.result;
    let parsed;
    if (typeof rawResult === 'string') {
      try {
        parsed = JSON.parse(rawResult);
      } catch {
        parsed = rawResult;
      }
    } else {
      parsed = rawResult;
    }

    // The GitHub "list repos" endpoint returns an array of repo objects
    if (Array.isArray(parsed)) {
      repos = parsed;
    } else if (parsed && Array.isArray(parsed.repositories)) {
      repos = parsed.repositories;
    } else if (parsed && typeof parsed === 'object') {
      // Some wrappers nest under a data or items key
      const inner = parsed.data || parsed.items || parsed.repos || parsed.content;
      if (Array.isArray(inner)) {
        repos = inner;
      } else if (typeof inner === 'string') {
        try {
          const again = JSON.parse(inner);
          repos = Array.isArray(again) ? again : [];
        } catch {
          repos = [];
        }
      }
    }
  } catch (err) {
    console.error('[dashboard] AgentKit error:', err);
    toolError = err.message || String(err);
  }

  // -------------------------------------------------------------------
  // Render the dashboard
  // -------------------------------------------------------------------
  const repoListHtml = (() => {
    if (toolError) {
      return `<p style="color:#e94560;">Could not fetch repositories: ${toolError}</p>`;
    }
    if (repos.length === 0) {
      return `<p>No repositories found.</p>`;
    }
    const items = repos
      .map((r) => {
        const fullName = r.full_name || r.fullName || '';
        const htmlUrl = r.html_url || r.htmlUrl || r.url || '';
        const displayName = fullName || htmlUrl || r.name || '(unknown)';
        const link = htmlUrl
          ? `<a class="repo-link" href="${htmlUrl}" target="_blank" rel="noopener">${displayName}</a>`
          : `<span class="repo-link">${displayName}</span>`;
        const desc = r.description ? ` — <em>${r.description}</em>` : '';
        return `<li>${link}${desc}</li>`;
      })
      .join('\n');
    return `<ul>${items}</ul>`;
  })();

  return res.status(200).send(html('Dashboard', `
    <div class="info-box">
      <h1>Dashboard</h1>
      <p>Signed in as: <span class="email-badge">${email}</span></p>
      <p><a href="/logout" class="logout-link">Sign out</a></p>
    </div>
    <div class="info-box">
      <h2>Your GitHub Repositories</h2>
      <p><em>Fetched live via Scalekit AgentKit (connection: <code>${GITHUB_CONNECTION}</code>, identifier: <code>${AGENTKIT_IDENTIFIER}</code>)</em></p>
      ${repoListHtml}
    </div>
  `));
});

// ---------------------------------------------------------------------------
// GET /logout — generate logout URL, clear cookies, redirect to Scalekit
// ---------------------------------------------------------------------------
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;

  // Generate the logout URL BEFORE clearing the idToken cookie
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken || '',
    postLogoutRedirectUri: POST_LOGOUT_URI,
  });

  // Clear all session cookies
  const clearOptions = { httpOnly: true, sameSite: 'lax', path: '/' };
  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
  res.clearCookie('idToken', clearOptions);

  return res.redirect(302, logoutUrl);
});

// ---------------------------------------------------------------------------
// GET /goodbye — public sign-out confirmation page
// ---------------------------------------------------------------------------
app.get('/goodbye', (req, res) => {
  res.status(200).send(html('Signed Out', `
    <div class="goodbye">
      <h1>You have been signed out</h1>
      <p>Your session has ended. Goodbye!</p>
      <p>You have successfully logged out of the application.</p>
      <a href="/" class="btn">Back to Home</a>
    </div>
  `));
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
