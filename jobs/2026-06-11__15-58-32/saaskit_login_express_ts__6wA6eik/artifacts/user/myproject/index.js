const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const qs = require('qs');
const { ScalekitClient } = require('@scalekit-sdk/node');

// Prevent unhandled promise rejection from SDK's background client-credentials auth
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason?.message || reason);
});

const app = express();
app.use(cookieParser());

const SCALEKIT_ENV_URL = process.env.SCALEKIT_ENV_URL;
const SCALEKIT_CLIENT_ID = process.env.SCALEKIT_CLIENT_ID;
const SCALEKIT_CLIENT_SECRET = process.env.SCALEKIT_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';

const scalekit = new ScalekitClient(SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET);

// Helper: decode JWT payload without verifying (for display purposes)
function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = Buffer.from(parts[1], 'base64').toString('utf8');
  return JSON.parse(payload);
}

// GET / — public landing page with sign-in link
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 2rem; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
    a:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome</h1>
    <p>Please sign in to continue.</p>
    <a href="/login">Sign In</a>
  </div>
</body>
</html>
  `);
});

// GET /login — redirect to Scalekit authorization URL
app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ['openid', 'profile', 'email', 'offline_access']
  });
  res.redirect(302, authUrl);
});

// GET /callback — exchange code for tokens, store in cookies, redirect to dashboard
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    // Make a direct token exchange request to get all tokens including refresh_token
    const tokenResponse = await axios.post(
      `${SCALEKIT_ENV_URL}/oauth/token`,
      qs.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: SCALEKIT_CLIENT_ID,
        client_secret: SCALEKIT_CLIENT_SECRET
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, id_token, refresh_token } = tokenResponse.data;

    // Set HttpOnly cookies
    const cookieOptions = { httpOnly: true, path: '/' };
    res.cookie('accessToken', access_token, cookieOptions);
    res.cookie('idToken', id_token, cookieOptions);
    if (refresh_token) {
      res.cookie('refreshToken', refresh_token, cookieOptions);
    }

    res.redirect(302, '/dashboard');
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

// GET /dashboard — protected route
app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;

  if (!idToken) {
    return res.redirect(302, '/login');
  }

  try {
    const claims = decodeJwtPayload(idToken);
    const email = claims.email || claims.preferred_username || 'Unknown';

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .email { font-size: 1.25rem; color: #4f46e5; margin: 1rem 0; }
    a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 2rem; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
    a:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dashboard</h1>
    <p>You are signed in as:</p>
    <p class="email">${email}</p>
    <a href="/logout">Sign Out</a>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('JWT decode error:', error);
    res.redirect(302, '/login');
  }
});

// GET /logout — redirect to Scalekit logout URL and clear cookies
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;

  // Build the logout URL before clearing cookies
  const logoutUrl = `${SCALEKIT_ENV_URL}/oidc/logout?${qs.stringify({
    id_token_hint: idToken || '',
    post_logout_redirect_uri: POST_LOGOUT_URI
  })}`;

  // Clear all auth cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('idToken', { path: '/' });

  res.redirect(302, logoutUrl);
});

// GET /goodbye — public sign-out confirmation page
app.get('/goodbye', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signed Out</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    p { color: #666; }
    a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 2rem; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
    a:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Goodbye!</h1>
    <p>You have been signed out successfully.</p>
    <a href="/">Sign In Again</a>
  </div>
</body>
</html>
  `);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});