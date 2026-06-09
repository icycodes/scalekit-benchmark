import express from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const PORT = 3000;
const BASE_URL = 'http://localhost:3000';
const REDIRECT_URI = `${BASE_URL}/callback`;
const POST_LOGOUT_URI = `${BASE_URL}/goodbye`;
const AUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const TOKEN_COOKIE_NAMES = ['accessToken', 'refreshToken', 'idToken'];

const requiredEnv = ['SCALEKIT_ENV_URL', 'SCALEKIT_CLIENT_ID', 'SCALEKIT_CLIENT_SECRET'];
for (const envName of requiredEnv) {
  if (!process.env[envName]) {
    console.warn(`Warning: ${envName} is not set. Scalekit routes will fail until it is provided.`);
  }
}

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET,
);

const app = express();
app.disable('x-powered-by');
app.use(cookieParser());

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f8fb; color: #172033; }
    main { width: min(92vw, 680px); padding: 2.5rem; border-radius: 18px; background: white; box-shadow: 0 24px 70px rgba(23, 32, 51, 0.12); }
    h1 { margin-top: 0; font-size: clamp(2rem, 5vw, 3rem); }
    p { font-size: 1.08rem; line-height: 1.6; }
    a.button, button { display: inline-block; margin-top: 1rem; padding: 0.85rem 1.15rem; border-radius: 10px; background: #4f46e5; color: white; text-decoration: none; font-weight: 700; }
    .secondary { background: #111827 !important; }
    code { padding: 0.15rem 0.35rem; border-radius: 6px; background: #eef2ff; color: #312e81; }
    @media (prefers-color-scheme: dark) {
      body { background: #0b1020; color: #eef2ff; }
      main { background: #111827; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35); }
      code { background: #1f2937; color: #c7d2fe; }
      .secondary { background: #374151 !important; }
    }
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
    return null;
  }

  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalizedPayload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode idToken payload:', error);
    return null;
  }
}

function getEmailFromClaims(claims) {
  return claims?.email || claims?.preferred_username || claims?.upn || claims?.sub || 'unknown user';
}

function tokenCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

function setTokenCookies(res, authResponse) {
  const oneDayMs = 24 * 60 * 60 * 1000;

  res.cookie('accessToken', authResponse.accessToken, tokenCookieOptions(oneDayMs));
  res.cookie('refreshToken', authResponse.refreshToken, tokenCookieOptions(30 * oneDayMs));
  res.cookie('idToken', authResponse.idToken, tokenCookieOptions(oneDayMs));
}

function clearTokenCookies(res) {
  for (const name of TOKEN_COOKIE_NAMES) {
    res.clearCookie(name, tokenCookieOptions());
  }
}

app.get('/', (req, res) => {
  res.type('html').send(htmlPage('Scalekit SaaSKit Demo', `
    <h1>Scalekit SaaSKit Demo</h1>
    <p>This public page starts a hosted Scalekit authentication flow.</p>
    <a class="button" href="/login">Sign in</a>
  `));
});

app.get('/login', (req, res, next) => {
  try {
    const authorizationUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
      scopes: AUTH_SCOPES,
    });

    res.redirect(302, authorizationUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/callback', async (req, res, next) => {
  try {
    const { code, error, error_description: errorDescription } = req.query;

    if (error) {
      return res.status(400).type('html').send(htmlPage('Authentication Error', `
        <h1>Authentication failed</h1>
        <p>${escapeHtml(errorDescription || error)}</p>
        <a class="button" href="/login">Try signing in again</a>
      `));
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).type('html').send(htmlPage('Missing Authorization Code', `
        <h1>Missing authorization code</h1>
        <p>The callback request did not include a valid <code>code</code> query parameter.</p>
        <a class="button" href="/login">Start sign in</a>
      `));
    }

    const authResponse = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    setTokenCookies(res, authResponse);

    res.redirect(302, '/dashboard');
  } catch (error) {
    next(error);
  }
});

app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;
  const claims = decodeJwtPayload(idToken);

  if (!claims) {
    return res.redirect(302, '/login');
  }

  const email = getEmailFromClaims(claims);
  res.type('html').send(htmlPage('Dashboard', `
    <h1>Dashboard</h1>
    <p>You are signed in as <strong id="user-email">${escapeHtml(email)}</strong>.</p>
    <p>Your Scalekit session is active.</p>
    <a class="button secondary" href="/logout">Sign out</a>
  `));
});

app.get('/logout', (req, res, next) => {
  try {
    const idToken = req.cookies.idToken;

    if (!idToken) {
      clearTokenCookies(res);
      return res.redirect(302, '/goodbye');
    }

    const logoutUrl = scalekit.getLogoutUrl({
      idTokenHint: idToken,
      postLogoutRedirectUri: POST_LOGOUT_URI,
    });
    clearTokenCookies(res);

    res.redirect(302, logoutUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/goodbye', (req, res) => {
  res.type('html').send(htmlPage('Signed Out', `
    <h1>Goodbye</h1>
    <p>You have been signed out successfully.</p>
    <a class="button" href="/">Return to the public landing page</a>
  `));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type('html').send(htmlPage('Server Error', `
    <h1>Something went wrong</h1>
    <p>${escapeHtml(err.message || 'Unexpected server error')}</p>
    <a class="button" href="/">Go home</a>
  `));
});

app.listen(PORT, () => {
  console.log(`Scalekit SaaSKit Express app listening on ${BASE_URL}`);
});
