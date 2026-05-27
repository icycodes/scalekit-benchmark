'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const app = express();
app.use(cookieParser());

// ---------- helpers ----------

/**
 * Decode a JWT payload without cryptographic verification.
 * The ID token has already been validated by Scalekit during the code exchange.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → Buffer → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
};

// ---------- routes ----------

// GET / — public landing page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh; margin: 0;
           background: #f4f6fb; }
    .card { background: #fff; border-radius: 12px; padding: 48px 56px; box-shadow: 0 4px 24px #0001;
            text-align: center; }
    h1 { margin-bottom: 8px; }
    p  { color: #555; margin-bottom: 32px; }
    a.btn { display: inline-block; padding: 14px 32px; background: #4f46e5; color: #fff;
            border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome</h1>
    <p>Sign in with your corporate account using Enterprise SSO.</p>
    <a class="btn" href="/login">Sign in with SSO</a>
  </div>
</body>
</html>`);
});

// GET /login — redirect to Scalekit hosted login / authorize page
app.get('/login', (req, res) => {
  const authorizeUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: SCOPES,
  });
  res.redirect(302, authorizeUrl);
});

// GET /callback — exchange code for tokens, store in HttpOnly cookies
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`<p>Authentication error: ${error} — ${error_description || ''}</p>`);
  }
  if (!code) {
    return res.status(400).send('<p>Missing authorization code.</p>');
  }

  try {
    const result = await scalekit.authenticateWithCode(String(code), REDIRECT_URI);

    res.cookie('idToken', result.idToken, COOKIE_OPTS);
    res.cookie('accessToken', result.accessToken, COOKIE_OPTS);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);

    return res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('authenticateWithCode error:', err);
    return res.status(500).send('<p>Failed to exchange authorization code. Please try again.</p>');
  }
});

// GET /dashboard — protected; shows email + org id
app.get('/dashboard', (req, res) => {
  const idToken = req.cookies && req.cookies.idToken;

  if (!idToken) {
    return res.redirect(302, '/login');
  }

  const claims = decodeJwtPayload(idToken);
  if (!claims) {
    // Corrupt token — force re-login
    res.clearCookie('idToken');
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.redirect(302, '/login');
  }

  const email = claims.email || '(email not available)';
  const oid = claims.oid || '(org id not available)';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh; margin: 0;
           background: #f4f6fb; }
    .card { background: #fff; border-radius: 12px; padding: 48px 56px; box-shadow: 0 4px 24px #0001;
            min-width: 360px; }
    h1 { margin-bottom: 24px; }
    .field { margin-bottom: 16px; }
    .label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #888;
             letter-spacing: .08em; }
    .value { font-size: 18px; font-weight: 500; margin-top: 4px; word-break: break-all; }
    a.btn { display: inline-block; margin-top: 32px; padding: 12px 28px; background: #ef4444;
            color: #fff; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; }
    a.btn:hover { background: #dc2626; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dashboard</h1>
    <div class="field">
      <div class="label">Signed-in Email</div>
      <div class="value" id="user-email">${email}</div>
    </div>
    <div class="field">
      <div class="label">Organization ID</div>
      <div class="value" id="org-id">${oid}</div>
    </div>
    <a class="btn" href="/logout">Sign out</a>
  </div>
</body>
</html>`);
});

// GET /logout — build logout URL (needs idToken), clear cookies, redirect to Scalekit logout
app.get('/logout', (req, res) => {
  const idToken = req.cookies && req.cookies.idToken;

  // Build the logout URL BEFORE clearing cookies so id_token_hint is available
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken || '',
    postLogoutRedirectUri: POST_LOGOUT_URI,
  });

  // Clear all session cookies
  res.clearCookie('idToken');
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  return res.redirect(302, logoutUrl);
});

// GET /goodbye — public post-logout confirmation page
app.get('/goodbye', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signed Out</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh; margin: 0;
           background: #f4f6fb; }
    .card { background: #fff; border-radius: 12px; padding: 48px 56px; box-shadow: 0 4px 24px #0001;
            text-align: center; }
    h1 { color: #16a34a; margin-bottom: 8px; }
    p  { color: #555; margin-bottom: 32px; }
    a.btn { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff;
            border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You have been signed out</h1>
    <p>You have been successfully logged out. Goodbye!</p>
    <a class="btn" href="/">Return to Home</a>
  </div>
</body>
</html>`);
});

// ---------- start ----------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
