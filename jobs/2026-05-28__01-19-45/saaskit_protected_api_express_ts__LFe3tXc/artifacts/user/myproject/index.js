'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ─── Scalekit client ───────────────────────────────────────────────────────────
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

// ─── Helper: decode a JWT payload (no signature verification needed here) ──────
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    // base64url → base64 → Buffer → string → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// ─── Middleware: validate the access token from cookies or Authorization header ─
async function requireAuth(req, res, next) {
  const isJson = req.path.startsWith('/api/');

  const token =
    req.cookies.accessToken ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    if (isJson) {
      return res.status(401).json({ error: 'No access token provided' });
    }
    return res.redirect('/login');
  }

  try {
    const valid = await scalekit.validateAccessToken(token);
    if (!valid) {
      if (isJson) {
        return res.status(401).json({ error: 'Invalid or expired access token' });
      }
      return res.redirect('/login');
    }
  } catch (err) {
    if (isJson) {
      return res.status(401).json({ error: 'Token validation failed' });
    }
    return res.redirect('/login');
  }

  next();
}

// ─── App setup ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

// ─── GET / — public landing page ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; padding: 2rem 3rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    h1 { margin-bottom: 1rem; }
    a.btn { display: inline-block; margin-top: 1rem; padding: 0.75rem 2rem; background: #4f46e5; color: #fff; border-radius: 6px; text-decoration: none; font-size: 1rem; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome</h1>
    <p>Please sign in to continue.</p>
    <a class="btn" href="/login">Sign In</a>
  </div>
</body>
</html>`);
});

// ─── GET /login — redirect to Scalekit authorize URL ───────────────────────────
app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: SCOPES,
  });
  res.redirect(authUrl);
});

// ─── GET /callback — exchange code for tokens, set HttpOnly cookies ─────────────
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect('/login');
  }

  try {
    const result = await scalekit.authenticateWithCode(String(code), REDIRECT_URI);

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
    };

    res.cookie('accessToken', result.accessToken, cookieOptions);
    res.cookie('refreshToken', result.refreshToken, cookieOptions);
    res.cookie('idToken', result.idToken, cookieOptions);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('authenticateWithCode error:', err);
    res.redirect('/login');
  }
});

// ─── GET /dashboard — protected HTML page ──────────────────────────────────────
app.get('/dashboard', requireAuth, (req, res) => {
  const idToken = req.cookies.idToken || '';
  const claims = decodeJwtPayload(idToken);
  const email = claims.email || '(unknown)';
  const sub = claims.sub || '(unknown)';

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Dashboard</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; padding: 2rem 3rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); min-width: 320px; }
    h1 { margin-bottom: 1.5rem; }
    .field { margin-bottom: 1rem; }
    .label { font-size: 0.8rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { font-size: 1rem; font-weight: 600; word-break: break-all; }
    a.btn { display: inline-block; margin-top: 1.5rem; padding: 0.6rem 1.5rem; background: #dc2626; color: #fff; border-radius: 6px; text-decoration: none; font-size: 0.95rem; }
    a.btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dashboard</h1>
    <div class="field">
      <div class="label">Email</div>
      <div class="value" id="user-email">${escapeHtml(email)}</div>
    </div>
    <div class="field">
      <div class="label">User ID (sub)</div>
      <div class="value" id="user-sub">${escapeHtml(sub)}</div>
    </div>
    <a class="btn" href="/logout">Sign Out</a>
  </div>
</body>
</html>`);
});

// ─── GET /api/me — protected JSON endpoint ─────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  const idToken = req.cookies.idToken || '';
  const claims = decodeJwtPayload(idToken);
  const email = claims.email || null;
  const sub = claims.sub || null;

  res.status(200).json({
    email,
    sub,
    name: claims.name || null,
  });
});

// ─── GET /logout — clear cookies, redirect to Scalekit logout URL ──────────────
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken || '';

  // Generate the logout URL BEFORE clearing cookies (idToken is needed)
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: POST_LOGOUT_URI,
  });

  // Clear all auth cookies
  const clearOptions = {
    httpOnly: true,
    sameSite: 'lax',
  };
  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
  res.clearCookie('idToken', clearOptions);

  res.redirect(logoutUrl);
});

// ─── GET /goodbye — public sign-out confirmation page ──────────────────────────
app.get('/goodbye', (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Signed Out</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; padding: 2rem 3rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    h1 { margin-bottom: 1rem; color: #16a34a; }
    a.btn { display: inline-block; margin-top: 1.5rem; padding: 0.6rem 1.5rem; background: #4f46e5; color: #fff; border-radius: 6px; text-decoration: none; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You have been signed out</h1>
    <p>You have successfully logged out. Goodbye!</p>
    <a class="btn" href="/">Back to Home</a>
  </div>
</body>
</html>`);
});

// ─── HTML escape helper ────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Start server ──────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
