const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const PORT = 3000;
const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_REDIRECT_URI = 'http://localhost:3000/goodbye';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const app = express();
app.use(cookieParser());

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
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; line-height: 1.5; }
    main { max-width: 760px; margin: 0 auto; }
    .button { display: inline-block; padding: 0.75rem 1rem; border-radius: 0.5rem; background: #111827; color: #fff; text-decoration: none; }
    .card { border: 1px solid #d1d5db; border-radius: 0.75rem; padding: 1rem; margin: 1rem 0; background: #f9fafb; }
    code { background: #eef2ff; padding: 0.15rem 0.35rem; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <main>
    ${body}
  </main>
</body>
</html>`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') {
    return {};
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return {};
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (_error) {
    return {};
  }
}

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme && scheme.toLowerCase() === 'bearer' && token) {
    return token;
  }
  return null;
}

async function validateRequest(req) {
  const accessToken = req.cookies.accessToken || getBearerToken(req);
  if (!accessToken) {
    return { valid: false, reason: 'Missing access token' };
  }

  let isValid = false;
  try {
    isValid = Boolean(await scalekit.validateAccessToken(accessToken));
  } catch (_error) {
    isValid = false;
  }

  if (!isValid) {
    return { valid: false, reason: 'Invalid access token' };
  }

  const idToken = req.cookies.idToken;
  const claims = decodeJwtPayload(idToken);
  if (!claims.email || !claims.sub) {
    return { valid: false, reason: 'Missing user claims' };
  }

  return {
    valid: true,
    accessToken,
    idToken,
    claims,
  };
}

function requireValidSession({ json = false } = {}) {
  return async (req, res, next) => {
    const auth = await validateRequest(req);
    if (!auth.valid) {
      if (json) {
        return res.status(401).json({ error: auth.reason });
      }
      return res.redirect(302, '/login');
    }

    req.auth = auth;
    return next();
  };
}

function setTokenCookies(res, authResponse) {
  const maxAge = Number(authResponse.expiresIn) > 0 ? Number(authResponse.expiresIn) * 1000 : undefined;
  res.cookie('accessToken', authResponse.accessToken, { ...cookieOptions, maxAge });
  res.cookie('refreshToken', authResponse.refreshToken || '', cookieOptions);
  res.cookie('idToken', authResponse.idToken, cookieOptions);
}

function clearTokenCookies(res) {
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie('idToken', cookieOptions);
}

app.get('/', (_req, res) => {
  res.status(200).type('html').send(htmlPage('Scalekit SaaSKit Demo', `
    <h1>Scalekit SaaSKit Demo</h1>
    <p>This public page starts a hosted Scalekit sign-in flow.</p>
    <p><a class="button" href="/login">Sign in with Scalekit</a></p>
  `));
});

app.get('/login', (_req, res) => {
  const authorizeUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: SCOPES,
  });
  res.redirect(302, authorizeUrl);
});

app.get('/callback', async (req, res) => {
  const { code, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.status(400).type('html').send(htmlPage('Sign-in error', `
      <h1>Sign-in failed</h1>
      <p>${escapeHtml(error)}</p>
      ${errorDescription ? `<p>${escapeHtml(errorDescription)}</p>` : ''}
      <p><a href="/login">Try signing in again</a></p>
    `));
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const authResponse = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    setTokenCookies(res, authResponse);
    return res.redirect(302, '/dashboard');
  } catch (callbackError) {
    console.error('Scalekit code exchange failed:', callbackError);
    return res.status(401).type('html').send(htmlPage('Authentication failed', `
      <h1>Authentication failed</h1>
      <p>The authorization code could not be exchanged for tokens.</p>
      <p><a href="/login">Try signing in again</a></p>
    `));
  }
});

app.get('/dashboard', requireValidSession(), (req, res) => {
  const email = escapeHtml(req.auth.claims.email);
  const sub = escapeHtml(req.auth.claims.sub);

  res.status(200).type('html').send(htmlPage('Dashboard', `
    <h1>Dashboard</h1>
    <p>You are signed in.</p>
    <section class="card" aria-label="Signed-in user information">
      <h2>Your user information</h2>
      <p>Email: <strong id="user-email">${email}</strong></p>
      <p>Scalekit user id: <strong id="user-sub">${sub}</strong></p>
    </section>
    <p><a class="button" href="/logout">Sign out</a></p>
    <script>
      fetch('/api/me', { credentials: 'same-origin' })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load /api/me')))
        .then((user) => {
          document.getElementById('user-email').textContent = user.email;
          document.getElementById('user-sub').textContent = user.sub;
        })
        .catch((error) => console.error(error));
    </script>
  `));
});

app.get('/api/me', requireValidSession({ json: true }), (req, res) => {
  res.status(200).json({
    email: req.auth.claims.email,
    sub: req.auth.claims.sub,
  });
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;

  // Generate the Scalekit logout URL before clearing cookies so id_token_hint is available.
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
  });

  clearTokenCookies(res);
  res.redirect(302, logoutUrl);
});

app.get('/goodbye', (_req, res) => {
  res.status(200).type('html').send(htmlPage('Signed out', `
    <h1>Goodbye</h1>
    <p>You have been signed out.</p>
    <p><a href="/">Return to the public landing page</a></p>
  `));
});

app.listen(PORT, () => {
  console.log(`Scalekit SaaSKit Express app listening on http://localhost:${PORT}`);
});
