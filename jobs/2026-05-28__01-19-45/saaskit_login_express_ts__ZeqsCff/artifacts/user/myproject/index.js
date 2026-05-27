'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ---------------------------------------------------------------------------
// Scalekit SDK initialisation
// ---------------------------------------------------------------------------
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

// ---------------------------------------------------------------------------
// Helper: decode a JWT payload without verifying the signature (for display)
// ---------------------------------------------------------------------------
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const payload = parts[1];
    // Pad base64url string to a multiple of 4
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Express app setup
// ---------------------------------------------------------------------------
const app = express();
app.use(cookieParser());

// ---------------------------------------------------------------------------
// GET / — public landing page with a sign-in entry point
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh;
           margin: 0; background: #f5f5f5; }
    h1 { color: #333; }
    a.btn { display: inline-block; margin-top: 24px; padding: 12px 28px;
            background: #4f46e5; color: #fff; text-decoration: none;
            border-radius: 6px; font-size: 1rem; font-weight: 600; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <h1>Welcome to SaaSKit Demo</h1>
  <p>Please sign in to access your dashboard.</p>
  <a class="btn" href="/login">Sign in</a>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /login — redirect to Scalekit's hosted authorize URL
// ---------------------------------------------------------------------------
app.get('/login', async (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
      scopes: SCOPES,
    });
    res.redirect(302, authUrl);
  } catch (err) {
    console.error('Error building authorization URL:', err);
    res.status(500).send('Internal Server Error');
  }
});

// ---------------------------------------------------------------------------
// GET /callback — exchange code for tokens, set HttpOnly cookies, redirect
// ---------------------------------------------------------------------------
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
    const result = await scalekit.authenticateWithCode(code, REDIRECT_URI);

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    };

    res.cookie('accessToken', result.accessToken, cookieOpts);
    res.cookie('refreshToken', result.refreshToken, cookieOpts);
    res.cookie('idToken', result.idToken, cookieOpts);

    res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('Error exchanging code:', err);
    res.status(500).send('Failed to authenticate. Please try again.');
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard — protected; shows user email decoded from idToken
// ---------------------------------------------------------------------------
app.get('/dashboard', (req, res) => {
  const { idToken } = req.cookies;

  if (!idToken) {
    return res.redirect(302, '/login');
  }

  const claims = decodeJwtPayload(idToken);
  const email = claims.email || claims.sub || '(unknown)';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh;
           margin: 0; background: #f0fdf4; }
    .card { background: #fff; padding: 40px 48px; border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,.08); text-align: center; }
    h1 { color: #166534; margin-top: 0; }
    p  { font-size: 1.1rem; color: #555; }
    .email { font-weight: 700; color: #111; }
    a.btn { display: inline-block; margin-top: 24px; padding: 10px 24px;
            background: #dc2626; color: #fff; text-decoration: none;
            border-radius: 6px; font-size: .95rem; font-weight: 600; }
    a.btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dashboard</h1>
    <p>Signed in as: <span class="email">${email}</span></p>
    <a class="btn" href="/logout">Sign out</a>
  </div>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /logout — build Scalekit logout URL, clear cookies, redirect
// ---------------------------------------------------------------------------
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;

  // Build the logout URL before clearing cookies (needs id_token_hint)
  let logoutUrl;
  try {
    logoutUrl = scalekit.getLogoutUrl(idToken, POST_LOGOUT_URI);
  } catch (err) {
    console.error('Error building logout URL:', err);
    // Fall back to goodbye page even if logout URL generation fails
    logoutUrl = POST_LOGOUT_URI;
  }

  const clearOpts = { httpOnly: true, sameSite: 'lax', path: '/' };
  res.clearCookie('accessToken', clearOpts);
  res.clearCookie('refreshToken', clearOpts);
  res.clearCookie('idToken', clearOpts);

  res.redirect(302, logoutUrl);
});

// ---------------------------------------------------------------------------
// GET /goodbye — public post-logout confirmation page
// ---------------------------------------------------------------------------
app.get('/goodbye', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Goodbye</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh;
           margin: 0; background: #fef9c3; }
    .card { background: #fff; padding: 40px 48px; border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,.08); text-align: center; }
    h1 { color: #92400e; margin-top: 0; }
    p  { font-size: 1.1rem; color: #555; }
    a  { color: #4f46e5; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You have been signed out</h1>
    <p>Goodbye! You have successfully signed out.</p>
    <p><a href="/">Back to home</a></p>
  </div>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
