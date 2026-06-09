const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();

// Initialize Scalekit SDK
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

// Cookie configuration
const COOKIE_OPTS = {
  httpOnly: true,
  secure: false, // set to true in production with HTTPS
  sameSite: 'lax',
  path: '/',
};

const CALLBACK_URL = 'http://localhost:3000/callback';
const POST_LOGOUT_URL = 'http://localhost:3000/goodbye';

// Middleware
app.use(cookieParser());

// ============================================================================
// Helper: decode JWT payload without verification (for display purposes only)
// ============================================================================
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url decode
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// ============================================================================
// Helper: check if user is authenticated (has idToken cookie)
// ============================================================================
function isAuthenticated(req) {
  return !!req.cookies && !!req.cookies.idToken;
}

// ============================================================================
// GET / — Public landing page with sign-in entry point
// ============================================================================
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scalekit SaaSKit Demo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 80px auto;
      text-align: center;
      background: #f9fafb;
      color: #111827;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; margin-bottom: 2rem; }
    a {
      display: inline-block;
      padding: 12px 32px;
      background: #4f46e5;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
    }
    a:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>Sign in to access your dashboard.</p>
  <a href="/login">Sign in</a>
</body>
</html>`);
});

// ============================================================================
// GET /login — Redirect to Scalekit authorization URL
// ============================================================================
app.get('/login', (_req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
    scopes: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(authUrl);
});

// ============================================================================
// GET /callback — Exchange code for tokens, set cookies, redirect to /dashboard
// ============================================================================
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, CALLBACK_URL);

    // Store tokens in HttpOnly cookies
    res.cookie('accessToken', result.accessToken, COOKIE_OPTS);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.cookie('idToken', result.idToken, COOKIE_OPTS);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// ============================================================================
// GET /dashboard — Protected route showing user's email
// ============================================================================
app.get('/dashboard', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.redirect('/login');
  }

  const idToken = req.cookies.idToken;
  const claims = decodeJwtPayload(idToken);
  const email = claims?.email || 'Unknown';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Scalekit SaaSKit Demo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 80px auto;
      text-align: center;
      background: #f9fafb;
      color: #111827;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .email {
      font-size: 1.2rem;
      color: #4f46e5;
      margin-bottom: 2rem;
    }
    a {
      display: inline-block;
      padding: 12px 32px;
      background: #ef4444;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
    }
    a:hover { background: #dc2626; }
  </style>
</head>
<body>
  <h1>Dashboard</h1>
  <p>Signed in as:</p>
  <p class="email">${email}</p>
  <a href="/logout">Sign out</a>
</body>
</html>`);
});

// ============================================================================
// GET /logout — Generate logout URL, clear cookies, redirect to Scalekit
// ============================================================================
app.get('/logout', (req, res) => {
  const idToken = req.cookies?.idToken || '';

  // Generate logout URL BEFORE clearing the idToken cookie
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: POST_LOGOUT_URL,
  });

  // Clear all auth cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('idToken', { path: '/' });

  res.redirect(logoutUrl);
});

// ============================================================================
// GET /goodbye — Public page confirming sign-out
// ============================================================================
app.get('/goodbye', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signed Out — Scalekit SaaSKit Demo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 80px auto;
      text-align: center;
      background: #f9fafb;
      color: #111827;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; margin-bottom: 2rem; }
    a {
      display: inline-block;
      padding: 12px 32px;
      background: #4f46e5;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
    }
    a:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Goodbye</h1>
  <p>You have been signed out.</p>
  <a href="/">Back to home</a>
</body>
</html>`);
});

// ============================================================================
// Start server
// ============================================================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
