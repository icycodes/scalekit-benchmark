const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const PORT = 3000;
const CALLBACK_URL = 'http://localhost:3000/callback';
const POST_LOGOUT_URL = 'http://localhost:3000/goodbye';

// Initialize the Scalekit SDK client using the provided environment variables
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const app = express();
app.use(cookieParser());

// ─── Helper: decode a JWT without verifying the signature ───────────────
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url-decode the payload (second part)
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// ─── Helper: clear auth cookies ─────────────────────────────────────────
function clearAuthCookies(res) {
  res.clearCookie('accessToken', { httpOnly: true, path: '/' });
  res.clearCookie('refreshToken', { httpOnly: true, path: '/' });
  res.clearCookie('idToken', { httpOnly: true, path: '/' });
}

// ─── GET / — Public landing page ────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; text-align: center; }
    h1 { color: #1a1a2e; }
    .btn { display: inline-block; padding: 14px 32px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; }
    .btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Welcome to Scalekit SaaSKit Demo</h1>
  <p>Sign in with your organization's SSO to get started.</p>
  <a class="btn" href="/login">Sign in with SSO</a>
</body>
</html>`);
});

// ─── GET /login — Build authorize URL and redirect ──────────────────────
app.get('/login', (_req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
    scopes: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(authUrl);
});

// ─── GET /callback — Exchange code for tokens, store in cookies ─────────
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, CALLBACK_URL);

    // Store tokens in HttpOnly cookies
    res.cookie('accessToken', result.accessToken, { httpOnly: true, path: '/' });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, path: '/' });
    res.cookie('idToken', result.idToken, { httpOnly: true, path: '/' });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// ─── GET /dashboard — Protected route, shows user info ──────────────────
app.get('/dashboard', (req, res) => {
  const idToken = req.cookies?.idToken;

  if (!idToken) {
    return res.redirect('/login');
  }

  const payload = decodeJwtPayload(idToken);

  if (!payload) {
    // Invalid token — clear cookies and redirect to login
    clearAuthCookies(res);
    return res.redirect('/login');
  }

  const email = payload.email || 'Unknown';
  const oid = payload.oid || 'Unknown';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Scalekit SaaSKit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; text-align: center; }
    h1 { color: #1a1a2e; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: left; }
    .card dt { font-weight: 600; color: #6b7280; font-size: 14px; text-transform: uppercase; }
    .card dd { margin: 4px 0 16px 0; font-size: 18px; color: #111827; }
    .btn-logout { display: inline-block; padding: 12px 28px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; }
    .btn-logout:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <h1>Dashboard</h1>
  <div class="card">
    <dl>
      <dt>Email</dt>
      <dd>${escapeHtml(email)}</dd>
      <dt>Organization ID</dt>
      <dd>${escapeHtml(oid)}</dd>
    </dl>
  </div>
  <a class="btn-logout" href="/logout">Sign out</a>
</body>
</html>`);
});

// ─── GET /logout — Generate logout URL, clear cookies, redirect ─────────
app.get('/logout', (req, res) => {
  const idToken = req.cookies?.idToken;

  // Generate the logout URL BEFORE clearing cookies
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken || '',
    postLogoutRedirectUri: POST_LOGOUT_URL,
  });

  // Clear auth cookies
  clearAuthCookies(res);

  res.redirect(logoutUrl);
});

// ─── GET /goodbye — Public signed-out confirmation page ─────────────────
app.get('/goodbye', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signed Out — Scalekit SaaSKit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 80px auto; text-align: center; }
    h1 { color: #1a1a2e; }
    .message { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .message p { color: #065f46; font-size: 18px; }
    .btn { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; }
    .btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Goodbye</h1>
  <div class="message">
    <p>You have been signed out successfully.</p>
  </div>
  <a class="btn" href="/">Back to Home</a>
</body>
</html>`);
});

// ─── Helper: HTML-escape user-supplied strings ──────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Start server ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Scalekit SaaSKit demo running at http://localhost:${PORT}`);
});
