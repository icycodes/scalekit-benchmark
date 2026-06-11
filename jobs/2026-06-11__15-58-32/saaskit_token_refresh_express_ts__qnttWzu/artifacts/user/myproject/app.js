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

const CALLBACK_URL = 'http://localhost:3000/callback';
const GOODBYE_URL  = 'http://localhost:3000/goodbye';
const COOKIE_OPTS  = { httpOnly: true, sameSite: 'lax' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode the payload of a JWT without verifying the signature.
 * Returns the parsed JSON object, or null on any error.
 */
function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url → base64 → Buffer → string → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Set the three session cookies (all HttpOnly).
 */
function setSessionCookies(res, { accessToken, refreshToken, idToken }) {
  if (accessToken)  res.cookie('accessToken',  accessToken,  COOKIE_OPTS);
  if (refreshToken) res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
  if (idToken)      res.cookie('idToken',      idToken,      COOKIE_OPTS);
}

/**
 * Clear the three session cookies.
 */
function clearSessionCookies(res) {
  res.clearCookie('accessToken',  COOKIE_OPTS);
  res.clearCookie('refreshToken', COOKIE_OPTS);
  res.clearCookie('idToken',      COOKIE_OPTS);
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
app.use(cookieParser());

// ---------------------------------------------------------------------------
// GET /  — public landing page
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 4rem auto; padding: 0 1rem; }
    a.btn { display: inline-block; padding: .6rem 1.4rem; background: #4f46e5; color: #fff;
            text-decoration: none; border-radius: 6px; font-size: 1rem; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Welcome to Scalekit SaaSKit Demo</h1>
  <p>This app demonstrates hosted login with explicit access-token refresh.</p>
  <a class="btn" href="/login">Sign in</a>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /login  — redirect to Scalekit hosted authorize URL
// ---------------------------------------------------------------------------
app.get('/login', async (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    });
    res.redirect(302, authUrl);
  } catch (err) {
    console.error('Error building authorization URL:', err);
    res.status(500).send('Failed to build authorization URL.');
  }
});

// ---------------------------------------------------------------------------
// GET /callback  — exchange code, store tokens, redirect to /dashboard
// ---------------------------------------------------------------------------
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, CALLBACK_URL);
    // result shape: { accessToken, refreshToken, idToken, user, ... }
    setSessionCookies(res, {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      idToken:      result.idToken,
    });
    res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('Error exchanging code:', err);
    clearSessionCookies(res);
    res.redirect(302, '/login');
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard  — protected; shows email, iat, exp, refresh & logout links
// ---------------------------------------------------------------------------
app.get('/dashboard', (req, res) => {
  const { accessToken, idToken } = req.cookies;

  if (!accessToken || !idToken) {
    return res.redirect(302, '/login');
  }

  const atPayload = decodeJwtPayload(accessToken);
  const itPayload = decodeJwtPayload(idToken);

  if (!atPayload || !itPayload) {
    clearSessionCookies(res);
    return res.redirect(302, '/login');
  }

  const email = itPayload.email || itPayload.sub || '(unknown)';
  const iat   = atPayload.iat;  // raw UNIX seconds integer
  const exp   = atPayload.exp;  // raw UNIX seconds integer

  const iatDate = new Date(iat * 1000).toUTCString();
  const expDate = new Date(exp * 1000).toUTCString();

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard – Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 680px; margin: 3rem auto; padding: 0 1rem; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem 2rem; margin-bottom: 1.5rem; }
    .label { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
    .value { font-size: 1.1rem; font-weight: 600; margin: .2rem 0 .8rem; }
    .actions { display: flex; gap: 1rem; flex-wrap: wrap; }
    a.btn { display: inline-block; padding: .55rem 1.2rem; text-decoration: none;
            border-radius: 6px; font-size: .95rem; font-weight: 500; }
    a.btn-primary { background: #4f46e5; color: #fff; }
    a.btn-primary:hover { background: #4338ca; }
    a.btn-danger  { background: #dc2626; color: #fff; }
    a.btn-danger:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <h1>Dashboard</h1>

  <div class="card">
    <div class="label">Signed-in user</div>
    <div class="value" id="user-email">${email}</div>
  </div>

  <div class="card">
    <div class="label">Access token – issued at (iat)</div>
    <div class="value" id="token-iat">iat: ${iat}</div>
    <div style="color:#6b7280;font-size:.9rem;">${iatDate}</div>

    <div class="label" style="margin-top:1rem;">Access token – expires at (exp)</div>
    <div class="value" id="token-exp">exp: ${exp}</div>
    <div style="color:#6b7280;font-size:.9rem;">${expDate}</div>
  </div>

  <div class="actions">
    <a class="btn btn-primary" href="/refresh-session">Refresh access token</a>
    <a class="btn btn-danger"  href="/logout">Sign out</a>
  </div>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /refresh-session  — exchange refresh token for new token pair
// ---------------------------------------------------------------------------
app.get('/refresh-session', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.redirect(302, '/login');
  }

  try {
    const result = await scalekit.refreshAccessToken(refreshToken);
    // Overwrite cookies with freshly issued tokens
    setSessionCookies(res, {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      idToken:      result.idToken || req.cookies.idToken, // keep old if not rotated
    });
    res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('Error refreshing access token:', err);
    clearSessionCookies(res);
    res.redirect(302, '/login');
  }
});

// ---------------------------------------------------------------------------
// GET /logout  — build logout URL, clear cookies, redirect to Scalekit logout
// ---------------------------------------------------------------------------
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;

  // Build the logout URL BEFORE clearing the idToken cookie
  let logoutUrl;
  try {
    logoutUrl = scalekit.getLogoutUrl(idToken, GOODBYE_URL);
  } catch (err) {
    console.error('Error building logout URL:', err);
    // Fall back to goodbye page directly if we can't build the URL
    clearSessionCookies(res);
    return res.redirect(302, GOODBYE_URL);
  }

  clearSessionCookies(res);
  res.redirect(302, logoutUrl);
});

// ---------------------------------------------------------------------------
// GET /goodbye  — post-logout confirmation page
// ---------------------------------------------------------------------------
app.get('/goodbye', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signed out – Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 4rem auto; padding: 0 1rem; text-align: center; }
    .icon { font-size: 3rem; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <div class="icon">👋</div>
  <h1>You have been signed out</h1>
  <p>Your session has ended. You are now logged out.</p>
  <p>Goodbye! <a href="/">Return to home page</a></p>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Scalekit SaaSKit demo listening on http://localhost:${PORT}`);
});
