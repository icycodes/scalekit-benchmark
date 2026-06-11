'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
app.use(cookieParser());

// Initialize the Scalekit SDK from environment variables
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const CALLBACK_URL = 'http://localhost:3000/callback';
const GOODBYE_URL = 'http://localhost:3000/goodbye';

// Utility: decode a JWT payload without verifying signature
function decodeJwtPayload(token) {
  try {
    const base64Payload = token.split('.')[1];
    const payload = Buffer.from(base64Payload, 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// GET / — public landing page with sign-in link
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem 3rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    h1 { margin-bottom: 0.5rem; }
    p { color: #555; margin-bottom: 1.5rem; }
    a.btn { display: inline-block; padding: 0.75rem 2rem; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome</h1>
    <p>Please sign in to continue.</p>
    <a class="btn" href="/login">Sign in</a>
  </div>
</body>
</html>`);
});

// GET /login — redirect to Scalekit hosted login
app.get('/login', async (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    });
    res.redirect(302, authUrl);
  } catch (err) {
    console.error('Error generating authorization URL:', err);
    res.status(500).send('Failed to initiate login.');
  }
});

// GET /callback — exchange code for tokens and store in HttpOnly cookies
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const authResult = await scalekit.authenticateWithCode(code, CALLBACK_URL);
    const { accessToken, refreshToken, idToken } = authResult;

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    };

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.cookie('idToken', idToken, cookieOptions);

    res.redirect(302, '/dashboard');
  } catch (err) {
    console.error('Error exchanging code for tokens:', err);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// GET /dashboard — protected route showing user email
app.get('/dashboard', (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    return res.redirect(302, '/login');
  }

  const claims = decodeJwtPayload(idToken);
  if (!claims) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    return res.redirect(302, '/login');
  }

  const email = claims.email || claims.sub || 'Unknown user';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem 3rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    h1 { margin-bottom: 0.5rem; }
    p { color: #555; margin-bottom: 1.5rem; }
    .email { font-weight: bold; color: #111; }
    a.btn { display: inline-block; padding: 0.75rem 2rem; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
    a.btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dashboard</h1>
    <p>Signed in as <span class="email">${email}</span></p>
    <a class="btn" href="/logout">Sign out</a>
  </div>
</body>
</html>`);
});

// GET /logout — generate logout URL, clear cookies, redirect to Scalekit logout
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;

  // Generate logout URL BEFORE clearing the idToken cookie
  let logoutUrl = GOODBYE_URL;
  if (idToken) {
    try {
      logoutUrl = scalekit.getLogoutUrl(idToken, GOODBYE_URL);
    } catch (err) {
      console.error('Error generating logout URL:', err);
    }
  }

  // Clear all session cookies
  const clearOptions = { path: '/' };
  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
  res.clearCookie('idToken', clearOptions);

  res.redirect(302, logoutUrl);
});

// GET /goodbye — public post-logout confirmation page
app.get('/goodbye', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Goodbye</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem 3rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    h1 { margin-bottom: 0.5rem; }
    p { color: #555; margin-bottom: 1.5rem; }
    a.btn { display: inline-block; padding: 0.75rem 2rem; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
    a.btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You have been signed out</h1>
    <p>Goodbye! You have successfully signed out.</p>
    <a class="btn" href="/">Back to home</a>
  </div>
</body>
</html>`);
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
