const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ---------------------------------------------------------------------------
// Initialize the Scalekit SDK client
// ---------------------------------------------------------------------------
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const CALLBACK_URL = 'http://localhost:3000/callback';
const POST_LOGOUT_URL = 'http://localhost:3000/goodbye';

const COOKIE_NAMES = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  idToken: 'idToken',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode a JWT payload (base64url) without verifying the signature.
 * Returns the parsed claims object, or null on any error.
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url decode
    const decoded = Buffer.from(
      payload.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Extract the access token from either the HttpOnly cookie or the
 * Authorization: Bearer <token> header.
 */
function extractAccessToken(req) {
  // 1. Check cookie (set by our own callback handler)
  if (req.cookies && req.cookies[COOKIE_NAMES.accessToken]) {
    return req.cookies[COOKIE_NAMES.accessToken];
  }
  // 2. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Clear all three auth cookies.
 */
function clearAuthCookies(res) {
  for (const name of Object.values(COOKIE_NAMES)) {
    res.clearCookie(name, { httpOnly: true, path: '/' });
  }
}

// ---------------------------------------------------------------------------
// Middleware: requireValidAccessToken
//
// This middleware validates the access token via the Scalekit SDK.  It is
// reused by both the protected HTML route and the protected JSON route.
// The only difference is how failures are reported — the caller can inspect
// the `authError` property we attach to the request.
// ---------------------------------------------------------------------------
async function requireValidAccessToken(req, res, next) {
  const accessToken = extractAccessToken(req);

  if (!accessToken) {
    req.authError = { status: 401, message: 'Missing access token' };
    return next();
  }

  let valid = false;
  try {
    valid = await scalekit.validateAccessToken(accessToken);
  } catch {
    // Treat any thrown error as "invalid token"
    valid = false;
  }

  if (!valid) {
    req.authError = { status: 401, message: 'Invalid or expired access token' };
    return next();
  }

  // Token is valid — decode the idToken claims for downstream handlers
  const idToken = req.cookies[COOKIE_NAMES.idToken];
  if (idToken) {
    const claims = decodeJwtPayload(idToken);
    if (claims) {
      req.userClaims = claims;
    }
  }

  next();
}

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------
const app = express();

app.use(cookieParser());

// ---------------------------------------------------------------------------
// GET / — Public landing page
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Scalekit SaaSKit Demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; text-align: center; }
    a { display: inline-block; padding: 12px 32px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-size: 18px; }
    a:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <h1>Welcome to the Scalekit SaaSKit Demo</h1>
  <p>Sign in to access your dashboard.</p>
  <a href="/login">Sign in</a>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /login — Build the Scalekit authorize URL and redirect
// ---------------------------------------------------------------------------
app.get('/login', (_req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
    scopes: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(authUrl);
});

// ---------------------------------------------------------------------------
// GET /callback — Exchange code for tokens, store in HttpOnly cookies
// ---------------------------------------------------------------------------
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, CALLBACK_URL);

    // Store tokens in HttpOnly cookies
    const cookieOpts = { httpOnly: true, path: '/' };

    res.cookie(COOKIE_NAMES.accessToken, result.accessToken, cookieOpts);
    res.cookie(COOKIE_NAMES.refreshToken, result.refreshToken, cookieOpts);
    res.cookie(COOKIE_NAMES.idToken, result.idToken, cookieOpts);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard — Protected HTML route (requires valid access token)
// ---------------------------------------------------------------------------
app.get('/dashboard', requireValidAccessToken, (req, res) => {
  if (req.authError) {
    return res.redirect('/login');
  }

  const email = req.userClaims?.email || 'Unknown';
  const sub = req.userClaims?.sub || 'Unknown';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dashboard — Scalekit SaaSKit</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; }
    .label { font-weight: 600; color: #6b7280; }
    .value { margin-bottom: 16px; font-size: 16px; word-break: break-all; }
    a { display: inline-block; padding: 10px 24px; background: #dc2626; color: #fff; text-decoration: none; border-radius: 6px; }
    a:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <h1>Dashboard</h1>
  <div class="card">
    <div class="label">Email</div>
    <div class="value">${escapeHtml(email)}</div>
    <div class="label">User ID (sub)</div>
    <div class="value">${escapeHtml(sub)}</div>
  </div>
  <p style="margin-top: 24px;">
    <a href="/logout">Sign out</a>
  </p>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /api/me — Protected JSON endpoint
// ---------------------------------------------------------------------------
app.get('/api/me', requireValidAccessToken, (req, res) => {
  if (req.authError) {
    return res.status(401).json({ error: req.authError.message });
  }

  res.json({
    email: req.userClaims?.email || null,
    sub: req.userClaims?.sub || null,
  });
});

// ---------------------------------------------------------------------------
// GET /logout — Generate logout URL, clear cookies, redirect
// ---------------------------------------------------------------------------
app.get('/logout', (req, res) => {
  const idToken = req.cookies[COOKIE_NAMES.idToken];

  // Generate the logout URL *before* clearing the idToken cookie,
  // because the ID token is needed as id_token_hint.
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken || undefined,
    postLogoutRedirectUri: POST_LOGOUT_URL,
  });

  // Clear all auth cookies
  clearAuthCookies(res);

  res.redirect(logoutUrl);
});

// ---------------------------------------------------------------------------
// GET /goodbye — Public post-logout confirmation page
// ---------------------------------------------------------------------------
app.get('/goodbye', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Signed Out — Scalekit SaaSKit</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 80px auto; text-align: center; }
    a { display: inline-block; padding: 10px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; }
    a:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <h1>Goodbye</h1>
  <p>You have been signed out.</p>
  <p><a href="/">Back to home</a></p>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------------
// Utility: escape HTML to prevent XSS
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
