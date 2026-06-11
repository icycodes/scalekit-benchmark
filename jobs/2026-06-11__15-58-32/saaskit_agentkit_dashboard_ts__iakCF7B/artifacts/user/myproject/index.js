const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
const PORT = 3000;

// Scalekit SDK initialization from environment variables
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';

// AgentKit constants (workspace-specific, hardcoded as instructed)
const GITHUB_CONNECTION = 'github-test';
const AGENTKIT_IDENTIFIER = 'zealt-user01';

app.use(cookieParser());

// ─── Helper: decode JWT payload (base64url) without verification ───
function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  // base64url → base64
  let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  // pad
  while (base64.length % 4 !== 0) base64 += '=';
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json);
}

// ─── Helper: render simple HTML page ───
function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #333; }
    a { color: #4f46e5; }
    .btn { display: inline-block; padding: 10px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px; font-size: 16px; }
    .btn:hover { background: #4338ca; }
    .btn-logout { background: #dc2626; }
    .btn-logout:hover { background: #b91c1c; }
    .repo-list { list-style: none; padding: 0; }
    .repo-list li { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .repo-list li:last-child { border-bottom: none; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

// ─── GET / — Public landing page ───
app.get('/', (req, res) => {
  res.send(htmlPage('Welcome', `
    <h1>Welcome</h1>
    <p>Sign in to view your GitHub repositories.</p>
    <a href="/login" class="btn">Sign in</a>
  `));
});

// ─── GET /login — Redirect to Scalekit authorize URL ───
app.get('/login', (req, res) => {
  const authorizeUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ['openid', 'profile', 'email', 'offline_access']
  });
  res.redirect(authorizeUrl);
});

// ─── GET /callback — Exchange code, set cookies, redirect to dashboard ───
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const authResponse = await scalekit.authenticateWithCode(code, REDIRECT_URI);

    // Set HttpOnly cookies for session
    const cookieOptions = { httpOnly: true, path: '/' };

    res.cookie('accessToken', authResponse.accessToken, cookieOptions);
    res.cookie('refreshToken', authResponse.refreshToken, cookieOptions);
    res.cookie('idToken', authResponse.idToken, cookieOptions);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).send(htmlPage('Error', `<h1>Authentication Failed</h1><p class="error">${err.message || 'Unknown error'}</p><a href="/">Try again</a>`));
  }
});

// ─── GET /dashboard — Protected route showing email + GitHub repos ───
app.get('/dashboard', async (req, res) => {
  const idToken = req.cookies.idToken;

  // Check authentication
  if (!idToken) {
    return res.redirect('/login');
  }

  try {
    // Decode the ID token to get user email
    const claims = decodeJwtPayload(idToken);
    const email = claims.email || 'Unknown';

    // Fetch GitHub repositories via AgentKit
    let repos = [];
    try {
      // First, discover available tools for the github-test connection
      const scopedTools = await scalekit.tools.listScopedTools(AGENTKIT_IDENTIFIER, {
        filter: {
          connectionNames: [GITHUB_CONNECTION]
        },
        pageSize: 100
      });

      // Find the tool that lists repos for the authenticated user
      let repoTool = null;
      if (scopedTools.tools && scopedTools.tools.length > 0) {
        for (const t of scopedTools.tools) {
          const tool = t.tool || t;
          const name = (tool && tool.id) || (tool && tool.name) || '';
          const defStr = tool.definition ? JSON.stringify(tool.definition).toLowerCase() : '';
          // Look for a tool related to listing repositories for authenticated user
          if (
            name.toLowerCase().includes('list') &&
            (name.toLowerCase().includes('repo') || name.toLowerCase().includes('repos')) &&
            (defStr.includes('authenticated') || defStr.includes('list_repos') || name.includes('authenticated'))
          ) {
            repoTool = tool;
            break;
          }
        }
        // Fallback: if no exact match, look for any repo listing tool
        if (!repoTool) {
          for (const t of scopedTools.tools) {
            const tool = t.tool || t;
            const name = (tool && tool.id) || (tool && tool.name) || '';
            if (name.toLowerCase().includes('repo') && name.toLowerCase().includes('list')) {
              repoTool = tool;
              break;
            }
          }
        }
        // Last fallback: just pick the first tool that has 'repo' in its name
        if (!repoTool) {
          for (const t of scopedTools.tools) {
            const tool = t.tool || t;
            const name = (tool && tool.id) || (tool && tool.name) || '';
            if (name.toLowerCase().includes('repos')) {
              repoTool = tool;
              break;
            }
          }
        }
      }

      if (repoTool) {
        const toolName = repoTool.id || repoTool.name;
        console.log(`Using tool: ${toolName}`);

        const result = await scalekit.tools.executeTool({
          toolName: toolName,
          identifier: AGENTKIT_IDENTIFIER,
          connector: GITHUB_CONNECTION,
          params: {}
        });

        // Parse the result data
        if (result.data) {
          const dataObj = result.data;
          // The data might be a struct/object with repos under various keys
          // Common patterns: { repositories: [...] }, { repos: [...] }, or it might be an array directly
          let repoArray = null;

          if (Array.isArray(dataObj)) {
            repoArray = dataObj;
          } else if (dataObj.repositories && Array.isArray(dataObj.repositories)) {
            repoArray = dataObj.repositories;
          } else if (dataObj.repos && Array.isArray(dataObj.repos)) {
            repoArray = dataObj.repos;
          } else if (dataObj.data && Array.isArray(dataObj.data)) {
            repoArray = dataObj.data;
          } else {
            // Try to find any array in the response that contains objects with full_name or html_url
            for (const key of Object.keys(dataObj)) {
              if (Array.isArray(dataObj[key]) && dataObj[key].length > 0 && typeof dataObj[key][0] === 'object') {
                repoArray = dataObj[key];
                break;
              }
            }
          }

          if (repoArray) {
            repos = repoArray;
          }
        }
      } else {
        console.error('No GitHub repository listing tool found');
      }
    } catch (agentErr) {
      console.error('AgentKit error:', agentErr);
      // Continue rendering dashboard even if AgentKit fails
    }

    // Build repo list HTML
    let repoHtml = '<p>No repositories found.</p>';
    if (repos.length > 0) {
      const repoItems = repos.slice(0, 20).map(r => {
        const fullName = r.full_name || r.fullName || r.name || 'unknown';
        const htmlUrl = r.html_url || r.htmlUrl || r.url || '';
        if (htmlUrl) {
          return `<li><a href="${htmlUrl}" target="_blank">${fullName}</a></li>`;
        }
        return `<li>${fullName}</li>`;
      }).join('\n');
      repoHtml = `<ul class="repo-list">${repoItems}</ul>`;
    }

    res.send(htmlPage('Dashboard', `
      <h1>Dashboard</h1>
      <p>Signed in as: <strong>${email}</strong></p>
      <h2>GitHub Repositories</h2>
      ${repoHtml}
      <br>
      <a href="/logout" class="btn btn-logout">Sign out</a>
    `));
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send(htmlPage('Error', `<h1>Error</h1><p class="error">${err.message || 'Unknown error'}</p><a href="/">Go back</a>`));
  }
});

// ─── GET /logout — Generate logout URL, clear cookies, redirect ───
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;

  // Generate logout URL BEFORE clearing cookies
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: POST_LOGOUT_URI
  });

  // Clear session cookies
  const clearOptions = { httpOnly: true, path: '/', expires: new Date(0) };
  res.cookie('accessToken', '', clearOptions);
  res.cookie('refreshToken', '', clearOptions);
  res.cookie('idToken', '', clearOptions);

  res.redirect(logoutUrl);
});

// ─── GET /goodbye — Public sign-out confirmation page ───
app.get('/goodbye', (req, res) => {
  res.send(htmlPage('Signed Out', `
    <h1>You have signed out</h1>
    <p>Goodbye! You have been successfully logged out.</p>
    <a href="/" class="btn">Sign in again</a>
  `));
});

// ─── Start server ───
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});