'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ─── Scalekit client ────────────────────────────────────────────────────────
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI       = 'http://localhost:3000/callback';
const POST_LOGOUT_URI    = 'http://localhost:3000/goodbye';
const SCOPES             = ['openid', 'profile', 'email', 'offline_access'];
const COOKIE_OPTS        = { httpOnly: true, sameSite: 'lax' };

// ─── JWT decode helper (no verification – access-token validation handles that)
function decodeIdToken(idToken) {
  try {
    const parts = idToken.split('.');
    if (parts.length < 2) return {};
    // base64url → base64 → Buffer → JSON
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return {};
  }
}

// ─── Token-validation middleware factory ────────────────────────────────────
// mode: 'html'  → redirect to /login on failure
// mode: 'json'  → respond 401 JSON on failure
function requireAuth(mode) {
  return async (req, res, next) => {
    // Accept cookie OR Authorization: Bearer <token>
    let accessToken = req.cookies && req.cookies.accessToken;
    if (!accessToken) {
      const auth = req.headers['authorization'] || '';
      if (auth.startsWith('Bearer ')) accessToken = auth.slice(7);
    }

    if (!accessToken) {
      return mode === 'json'
        ? res.status(401).json({ error: 'Access token missing' })
        : res.redirect('/login');
    }

    let valid = false;
    try {
      valid = await scalekit.validateAccessToken(accessToken);
    } catch (_) {
      valid = false;
    }

    if (!valid) {
      return mode === 'json'
        ? res.status(401).json({ error: 'Access token invalid or expired' })
        : res.redirect('/login');
    }

    // Attach the token to the request so handlers can use it
    req.accessToken = accessToken;
    next();
  };
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

// ── GET / ─ Public landing page ──────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; padding: 0 16px; }
    a.btn { display: inline-block; padding: 12px 28px; background: #4f46e5; color: #fff;
            border-radius: 6px; text-decoration: none; font-size: 1rem; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>Sign in with your Scalekit account to continue.</p>
  <a class="btn" href="/login">Sign In</a>
</body>
</html>`);
});

// ── GET /login ─ Redirect to Scalekit hosted login ──────────────────────────
app.get('/login', (_req, res) => {
  const authorizeUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: SCOPES,
  });
  res.redirect(302, authorizeUrl);
});

// ── GET /callback ─ Exchange code, set cookies, redirect to dashboard ────────
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    // authenticateWithCode returns { accessToken, refreshToken, idToken, user, ... }
    const { accessToken, refreshToken, idToken } = result;

    res.cookie('accessToken',  accessToken,  COOKIE_OPTS);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.cookie('idToken',      idToken,      COOKIE_OPTS);

    return res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('authenticateWithCode error:', err);
    return res.status(500).send('Authentication failed. Please try again.');
  }
});

// ── GET /dashboard ─ Protected HTML page ─────────────────────────────────────
app.get('/dashboard', requireAuth('html'), (req, res) => {
  const idToken = req.cookies.idToken || '';
  const claims  = decodeIdToken(idToken);
  const email   = claims.email || '(unknown)';
  const sub     = claims.sub   || '(unknown)';

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 16px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-top: 24px; }
    .label { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { font-size: 1rem; font-weight: 600; margin-top: 4px; word-break: break-all; }
    a.btn { display: inline-block; margin-top: 24px; padding: 10px 24px;
            background: #dc2626; color: #fff; border-radius: 6px; text-decoration: none; }
    a.btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <h1>Dashboard</h1>
  <p>You are signed in.</p>
  <div class="card">
    <div class="label">Email</div>
    <div class="value" id="user-email">${escapeHtml(email)}</div>
    <div class="label" style="margin-top:16px;">User ID (sub)</div>
    <div class="value" id="user-sub">${escapeHtml(sub)}</div>
  </div>
  <a class="btn" href="/logout">Sign Out</a>
</body>
</html>`);
});

// ── GET /api/me ─ Protected JSON endpoint ────────────────────────────────────
app.get('/api/me', requireAuth('json'), (req, res) => {
  const idToken = req.cookies.idToken || '';
  const claims  = decodeIdToken(idToken);

  return res.status(200).json({
    sub:   claims.sub   || null,
    email: claims.email || null,
    name:  claims.name  || null,
  });
});

// ── GET /logout ─ Clear cookies and redirect to Scalekit logout ───────────────
app.get('/logout', (req, res) => {
  // Build the logout URL BEFORE clearing the idToken cookie
  const idToken = req.cookies.idToken || '';

  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint:          idToken,
    postLogoutRedirectUri: POST_LOGOUT_URI,
  });

  // Clear all session cookies
  res.clearCookie('accessToken',  COOKIE_OPTS);
  res.clearCookie('refreshToken', COOKIE_OPTS);
  res.clearCookie('idToken',      COOKIE_OPTS);

  return res.redirect(302, logoutUrl);
});

// ── GET /goodbye ─ Post-logout confirmation page ──────────────────────────────
app.get('/goodbye', (_req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signed Out</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 80px auto; padding: 0 16px; text-align: center; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <h1>You have been signed out</h1>
  <p>You have successfully logged out. Your session has ended.</p>
  <p><a href="/">Return to home</a></p>
</body>
</html>`);
});

// ─── Tiny HTML-escape helper ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
