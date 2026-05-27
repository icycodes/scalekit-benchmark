'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ---------------------------------------------------------------------------
// Scalekit client
// ---------------------------------------------------------------------------
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET,
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';

// AgentKit constants (hardcoded per spec)
const GITHUB_CONNECTION = 'github-test';
const AGENTKIT_IDENTIFIER = 'zealt-user01';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload without verifying the signature.
 * Returns the parsed JSON object from the base64url-encoded payload segment.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    // base64url → base64 → Buffer → string → JSON
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/** Simple auth guard — returns true when the request has an idToken cookie. */
function isAuthenticated(req) {
  return Boolean(req.cookies && req.cookies.idToken);
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(cookieParser());

// ---------------------------------------------------------------------------
// GET /  — landing page
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scalekit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 20px; }
    h1 { color: #333; }
    .btn {
      display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff;
      text-decoration: none; border-radius: 8px; font-size: 1rem; font-weight: 600;
    }
    .btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Welcome to Scalekit SaaSKit + AgentKit Demo</h1>
  <p>Sign in to view your GitHub repositories fetched via Scalekit AgentKit.</p>
  <a class="btn" href="/login">Sign in</a>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /login  — initiate Scalekit OIDC flow
// ---------------------------------------------------------------------------
app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(authUrl);
});

// ---------------------------------------------------------------------------
// GET /callback  — exchange code for tokens, set HttpOnly cookies
// ---------------------------------------------------------------------------
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`<p>Authentication error: ${error} — ${error_description}</p>`);
  }

  if (!code) {
    return res.redirect('/login');
  }

  try {
    const authResponse = await scalekit.authenticateWithCode(String(code), REDIRECT_URI);

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    };

    res.cookie('accessToken', authResponse.accessToken, cookieOptions);
    res.cookie('refreshToken', authResponse.refreshToken, cookieOptions);
    res.cookie('idToken', authResponse.idToken, cookieOptions);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send(`<p>Authentication failed: ${err.message}</p>`);
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard  — protected page with email + GitHub repos
// ---------------------------------------------------------------------------
app.get('/dashboard', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.redirect('/login');
  }

  const idToken = req.cookies.idToken;
  const claims = decodeJwtPayload(idToken);
  const email = claims.email || '(unknown)';

  let reposHtml = '';
  let errorMsg = '';

  try {
    // -----------------------------------------------------------------------
    // Discover the correct tool name for listing GitHub repos, then execute it.
    // We call listScopedTools first to find the "list repos" tool dynamically.
    // -----------------------------------------------------------------------
    let listRepoToolName = null;

    try {
      const scopedTools = await scalekit.tools.listScopedTools(AGENTKIT_IDENTIFIER, {
        filter: { connectors: [GITHUB_CONNECTION] },
        pageSize: 100,
      });

      const tools = scopedTools.tools || [];
      console.log('Available GitHub tools:', tools.map(t => t.name || t.toolName));

      // Find the tool that lists repos for the authenticated user
      const repoTool = tools.find(t => {
        const name = (t.name || t.toolName || '').toLowerCase();
        return (
          name.includes('list') &&
          (name.includes('repo') || name.includes('repositories')) &&
          (name.includes('authenticated') || name.includes('user') || name.includes('my') || !name.includes('org') && !name.includes('fork'))
        );
      }) || tools.find(t => {
        const name = (t.name || t.toolName || '').toLowerCase();
        return name.includes('repo') || name.includes('repositories');
      });

      if (repoTool) {
        listRepoToolName = repoTool.name || repoTool.toolName;
        console.log('Selected tool:', listRepoToolName);
      }
    } catch (listErr) {
      console.warn('listScopedTools failed, will try default tool name:', listErr.message);
    }

    // Fall back to a well-known tool name if discovery failed
    if (!listRepoToolName) {
      listRepoToolName = 'github_list_repos_for_authenticated_user';
    }

    // Execute the tool
    const execResult = await scalekit.tools.executeTool({
      toolName: listRepoToolName,
      identifier: AGENTKIT_IDENTIFIER,
      connector: GITHUB_CONNECTION,
      params: { per_page: 20 },
    });

    // Parse the result — the SDK returns an ExecuteToolResponse
    // The actual payload lives in result.result (a JSON string or object)
    let repos = [];
    const raw = execResult.result ?? execResult.data ?? execResult;

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        repos = Array.isArray(parsed) ? parsed : (parsed.repositories || parsed.repos || [parsed]);
      } catch {
        // raw might already be rendered text; show as-is
        reposHtml = `<pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow:auto">${raw}</pre>`;
      }
    } else if (Array.isArray(raw)) {
      repos = raw;
    } else if (raw && typeof raw === 'object') {
      repos = raw.repositories || raw.repos || raw.items || [raw];
    }

    if (repos.length > 0 && !reposHtml) {
      reposHtml = '<ul style="list-style:none;padding:0">' +
        repos.map(r => {
          const fullName = r.full_name || r.fullName || `${r.owner?.login || ''}/${r.name || r.id}`;
          const url = r.html_url || r.url || '#';
          const isPrivate = r.private ? ' 🔒' : '';
          return `<li style="margin:6px 0;padding:10px;background:#f8f9fa;border-radius:6px">
            <a href="${url}" target="_blank" rel="noopener noreferrer" style="font-weight:600;color:#4f46e5">${fullName}</a>${isPrivate}
            ${r.description ? `<br><small style="color:#666">${r.description}</small>` : ''}
          </li>`;
        }).join('') +
        '</ul>';
    } else if (!reposHtml) {
      reposHtml = '<p>No repositories found.</p>';
    }
  } catch (err) {
    console.error('AgentKit error:', err);
    errorMsg = `<p style="color:red">Could not load repositories: ${err.message}</p>`;
  }

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; }
    .user-card {
      background: #f0f0ff; border: 1px solid #c7d2fe; border-radius: 10px;
      padding: 16px 20px; margin-bottom: 24px;
    }
    .user-email { font-size: 1.1rem; font-weight: 700; color: #4f46e5; }
    .logout-btn {
      display: inline-block; padding: 8px 20px; background: #ef4444; color: #fff;
      text-decoration: none; border-radius: 6px; font-size: 0.9rem; font-weight: 600;
      float: right;
    }
    .logout-btn:hover { background: #dc2626; }
    h2 { border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
  </style>
</head>
<body>
  <div class="user-card">
    <a class="logout-btn" href="/logout">Sign out</a>
    <div>Signed in as</div>
    <div class="user-email">${email}</div>
  </div>

  <h2>Your GitHub Repositories</h2>
  ${errorMsg}
  ${reposHtml}
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /logout  — build logout URL (with idToken), clear cookies, redirect
// ---------------------------------------------------------------------------
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken || '';

  // Build the logout URL BEFORE clearing cookies (idToken required as hint)
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: POST_LOGOUT_URI,
  });

  // Clear all session cookies
  const clearOpts = { httpOnly: true, sameSite: 'lax', path: '/' };
  res.clearCookie('accessToken', clearOpts);
  res.clearCookie('refreshToken', clearOpts);
  res.clearCookie('idToken', clearOpts);

  res.redirect(logoutUrl);
});

// ---------------------------------------------------------------------------
// GET /goodbye  — post-logout confirmation page
// ---------------------------------------------------------------------------
app.get('/goodbye', (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signed Out</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 80px auto; padding: 0 20px; text-align: center; }
    h1 { color: #333; }
    .icon { font-size: 3rem; margin-bottom: 12px; }
    .msg { font-size: 1.2rem; color: #555; margin-bottom: 28px; }
    a { color: #4f46e5; font-weight: 600; }
  </style>
</head>
<body>
  <div class="icon">👋</div>
  <h1>You have been signed out</h1>
  <p class="msg">You have successfully logged out. Your session has ended.</p>
  <p><a href="/">Return to homepage</a></p>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
