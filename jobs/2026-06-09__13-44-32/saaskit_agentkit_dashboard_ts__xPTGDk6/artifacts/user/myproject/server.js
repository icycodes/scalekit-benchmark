const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const PORT = 3000;
const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_REDIRECT_URI = 'http://localhost:3000/goodbye';
const GITHUB_CONNECTION_NAME = 'github-test';
const AGENTKIT_IDENTIFIER = 'zealt-user01';
const GITHUB_LIST_REPOS_TOOL = 'github_user_repos_list';

const app = express();
app.use(cookieParser());

let scalekitClient;
function getScalekitClient() {
  if (!scalekitClient) {
    const { SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET } = process.env;
    if (!SCALEKIT_ENV_URL || !SCALEKIT_CLIENT_ID || !SCALEKIT_CLIENT_SECRET) {
      throw new Error(
        'Missing required Scalekit environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET'
      );
    }

    scalekitClient = new ScalekitClient(
      SCALEKIT_ENV_URL,
      SCALEKIT_CLIENT_ID,
      SCALEKIT_CLIENT_SECRET
    );
  }

  return scalekitClient;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
};

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 840px; margin: 48px auto; padding: 0 24px; line-height: 1.5; color: #172033; }
    a.button, button { display: inline-block; padding: 10px 16px; border-radius: 8px; background: #315efb; color: white; text-decoration: none; font-weight: 650; border: 0; cursor: pointer; }
    .card { border: 1px solid #d8deea; border-radius: 12px; padding: 24px; box-shadow: 0 4px 16px rgba(20, 33, 61, 0.08); }
    .muted { color: #5b6578; }
    ul { padding-left: 1.25rem; }
    li { margin: 0.45rem 0; }
    code { background: #f2f4f8; border-radius: 4px; padding: 2px 4px; }
    .error { color: #9f1239; background: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT format');
  }

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function extractRepositories(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.array)) {
    return data.array;
  }

  if (Array.isArray(data.repositories)) {
    return data.repositories;
  }

  if (Array.isArray(data.repos)) {
    return data.repos;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  return [];
}

async function fetchGitHubRepositories() {
  const scalekit = getScalekitClient();
  const response = await scalekit.tools.executeTool({
    toolName: GITHUB_LIST_REPOS_TOOL,
    identifier: AGENTKIT_IDENTIFIER,
    connector: GITHUB_CONNECTION_NAME,
    params: {
      page: 1,
      per_page: 10,
    },
  });

  return extractRepositories(response.data);
}

app.get('/', (_req, res) => {
  res.status(200).type('html').send(
    htmlPage(
      'Scalekit SaaSKit + AgentKit Demo',
      `<main class="card">
        <h1>Scalekit SaaSKit + AgentKit Demo</h1>
        <p class="muted">Sign in with Scalekit, then view GitHub repositories fetched through AgentKit.</p>
        <p><a class="button" href="/login">Sign in</a></p>
      </main>`
    )
  );
});

app.get('/login', (req, res, next) => {
  try {
    const scalekit = getScalekitClient();
    const authorizationUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    });

    res.redirect(302, authorizationUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/callback', async (req, res, next) => {
  try {
    const code = req.query.code;
    if (typeof code !== 'string' || !code) {
      res.status(400).type('html').send(
        htmlPage(
          'Missing authorization code',
          `<main class="card">
            <h1>Missing authorization code</h1>
            <p class="error">The callback did not include a valid <code>code</code> query parameter.</p>
            <p><a href="/login">Try signing in again</a></p>
          </main>`
        )
      );
      return;
    }

    const scalekit = getScalekitClient();
    const auth = await scalekit.authenticateWithCode(code, REDIRECT_URI);

    res.cookie('accessToken', auth.accessToken, cookieOptions);
    res.cookie('refreshToken', auth.refreshToken, cookieOptions);
    res.cookie('idToken', auth.idToken, cookieOptions);
    res.redirect(302, '/dashboard');
  } catch (error) {
    next(error);
  }
});

app.get('/dashboard', async (req, res, next) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    res.redirect(302, '/login');
    return;
  }

  let claims;
  try {
    claims = decodeJwtPayload(idToken);
  } catch (_error) {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('idToken', cookieOptions);
    res.redirect(302, '/login');
    return;
  }

  try {
    const email = claims.email || claims.preferred_username || 'unknown user';
    const repositories = await fetchGitHubRepositories();
    const repositoryItems = repositories.slice(0, 10).map((repo) => {
      const fullName = repo.full_name || [repo.owner?.login, repo.name].filter(Boolean).join('/') || repo.name || repo.html_url;
      const htmlUrl = repo.html_url || repo.url || '#';
      return `<li><a href="${escapeHtml(htmlUrl)}" target="_blank" rel="noreferrer">${escapeHtml(fullName || htmlUrl)}</a></li>`;
    });

    const repositoryList = repositoryItems.length
      ? `<ul>${repositoryItems.join('\n')}</ul>`
      : '<p class="muted">No GitHub repositories were returned for this connected account.</p>';

    res.status(200).type('html').send(
      htmlPage(
        'Dashboard',
        `<main class="card">
          <h1>Dashboard</h1>
          <p>Signed in as <strong>${escapeHtml(email)}</strong></p>
          <h2>GitHub repositories for ${escapeHtml(AGENTKIT_IDENTIFIER)}</h2>
          <p class="muted">Fetched live through Scalekit AgentKit connection <code>${escapeHtml(GITHUB_CONNECTION_NAME)}</code> using <code>executeTool</code>.</p>
          ${repositoryList}
          <p><a class="button" href="/logout">Sign out</a></p>
        </main>`
      )
    );
  } catch (error) {
    next(error);
  }
});

app.get('/logout', (req, res, next) => {
  try {
    const idToken = req.cookies.idToken;
    if (!idToken) {
      res.clearCookie('accessToken', cookieOptions);
      res.clearCookie('refreshToken', cookieOptions);
      res.clearCookie('idToken', cookieOptions);
      res.redirect(302, '/goodbye');
      return;
    }

    const scalekit = getScalekitClient();
    const logoutUrl = scalekit.getLogoutUrl({
      idTokenHint: idToken,
      postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
    });

    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('idToken', cookieOptions);
    res.redirect(302, logoutUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/goodbye', (_req, res) => {
  res.status(200).type('html').send(
    htmlPage(
      'Signed out',
      `<main class="card">
        <h1>Goodbye — you are signed out</h1>
        <p class="muted">Your local application session has been cleared.</p>
        <p><a href="/">Return to the landing page</a></p>
      </main>`
    )
  );
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).type('html').send(
    htmlPage(
      'Application error',
      `<main class="card">
        <h1>Application error</h1>
        <p class="error">${escapeHtml(error.message || 'Unexpected server error')}</p>
        <p><a href="/">Return to the landing page</a></p>
      </main>`
    )
  );
});

app.listen(PORT, () => {
  console.log(`Scalekit SaaSKit + AgentKit demo listening on http://localhost:${PORT}`);
});
