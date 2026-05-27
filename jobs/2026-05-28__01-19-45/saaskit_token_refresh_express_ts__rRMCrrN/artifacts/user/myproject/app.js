'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ── Scalekit client ──────────────────────────────────────────────────────────
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const CALLBACK_URL = 'http://localhost:3000/callback';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode a JWT payload segment (no signature verification — used for display only).
 * Returns the parsed object, or null on failure.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // Base64url → Base64 → Buffer → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Set accessToken, refreshToken, and idToken as HttpOnly cookies.
 */
function setAuthCookies(res, { accessToken, refreshToken, idToken }) {
  const cookieOpts = { httpOnly: true, sameSite: 'lax' };
  if (accessToken) res.cookie('accessToken', accessToken, cookieOpts);
  if (refreshToken) res.cookie('refreshToken', refreshToken, cookieOpts);
  if (idToken)      res.cookie('idToken',      idToken,      cookieOpts);
}

/**
 * Clear accessToken, refreshToken, and idToken cookies.
 */
function clearAuthCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

// ── GET / ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 80px auto; text-align: center; }
    a.btn {
      display: inline-block; padding: 12px 28px; background: #4f46e5;
      color: #fff; text-decoration: none; border-radius: 6px; font-size: 1rem;
    }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>Sign in to access your dashboard.</p>
  <a class="btn" href="/login">Sign in</a>
</body>
</html>`);
});

// ── GET /login ───────────────────────────────────────────────────────────────
app.get('/login', async (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
      scopes: SCOPES,
    });
    res.redirect(302, authUrl);
  } catch (err) {
    console.error('Error building authorization URL:', err);
    res.status(500).send('Failed to initiate login.');
  }
});

// ── GET /callback ────────────────────────────────────────────────────────────
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.status(400).send(`Authentication error: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, CALLBACK_URL);
    setAuthCookies(res, {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      idToken:      result.idToken,
    });
    res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('Error exchanging code:', err);
    res.status(500).send('Failed to exchange authorization code.');
  }
});

// ── GET /dashboard ───────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) => {
  const { accessToken, idToken } = req.cookies;

  if (!accessToken || !idToken) {
    return res.redirect(302, '/login');
  }

  const accessPayload = decodeJwtPayload(accessToken);
  const idPayload     = decodeJwtPayload(idToken);

  if (!accessPayload || !idPayload) {
    clearAuthCookies(res);
    return res.redirect(302, '/login');
  }

  const email = idPayload.email || '(unknown)';
  const iat   = accessPayload.iat;
  const exp   = accessPayload.exp;

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 60px auto; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    .label { color: #6b7280; font-size: 0.85rem; text-transform: uppercase; letter-spacing: .05em; }
    .value { font-size: 1.1rem; font-weight: 600; margin-top: 4px; word-break: break-all; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    a.btn {
      display: inline-block; padding: 10px 22px; border-radius: 6px;
      text-decoration: none; font-size: 0.95rem; cursor: pointer;
    }
    a.btn-primary   { background: #4f46e5; color: #fff; }
    a.btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    a.btn:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <h1>Dashboard</h1>

  <div class="card">
    <div class="label">Signed-in user</div>
    <div class="value" id="user-email">${email}</div>
  </div>

  <div class="card">
    <div class="label">Access token claims</div>
    <div style="margin-top: 12px;">
      <div class="label">iat (issued-at)</div>
      <div class="value" id="token-iat">iat: ${iat}</div>
    </div>
    <div style="margin-top: 12px;">
      <div class="label">exp (expires-at)</div>
      <div class="value" id="token-exp">exp: ${exp}</div>
    </div>
  </div>

  <div class="actions">
    <a class="btn btn-primary" href="/refresh-session">Refresh access token</a>
    <a class="btn btn-secondary" href="/logout">Sign out</a>
  </div>
</body>
</html>`);
});

// ── GET /refresh-session ─────────────────────────────────────────────────────
app.get('/refresh-session', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.redirect(302, '/login');
  }

  try {
    const result = await scalekit.refreshAccessToken(refreshToken);

    // The SDK returns a new accessToken, refreshToken, and (usually) idToken.
    const newIdToken = result.idToken || req.cookies.idToken;

    setAuthCookies(res, {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      idToken:      newIdToken,
    });

    res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('Error refreshing access token:', err);
    clearAuthCookies(res);
    res.redirect(302, '/login');
  }
});

// ── GET /logout ──────────────────────────────────────────────────────────────
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;

  // Build logout URL BEFORE clearing cookies (idToken is required as hint).
  let logoutUrl;
  try {
    logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
  } catch (err) {
    console.error('Error building logout URL:', err);
    // Fall back to goodbye page if URL generation fails.
    clearAuthCookies(res);
    return res.redirect(302, '/goodbye');
  }

  clearAuthCookies(res);
  res.redirect(302, logoutUrl);
});

// ── GET /goodbye ─────────────────────────────────────────────────────────────
app.get('/goodbye', (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signed out</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 80px auto; text-align: center; }
    a { color: #4f46e5; text-decoration: none; }
  </style>
</head>
<body>
  <h1>You have been signed out</h1>
  <p>You have successfully logged out. Your session has ended.</p>
  <p>Goodbye! <a href="/">Return to home</a></p>
</body>
</html>`);
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
