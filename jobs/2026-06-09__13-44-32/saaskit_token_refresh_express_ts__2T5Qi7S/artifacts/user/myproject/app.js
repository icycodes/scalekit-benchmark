const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
app.use(cookieParser());

// Initialize the Scalekit Node SDK
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

// Helper function to decode JWT payload
function decodeJwt(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    console.error('Error decoding JWT:', err);
    return null;
  }
}

// GET / — a public landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Home</title>
      <style>
        body { font-family: sans-serif; margin: 40px; }
        .btn { display: inline-block; padding: 10px 15px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h2>Welcome to Scalekit SaaSKit App</h2>
      <p>This is a small Express.js application integrating Scalekit SaaSKit.</p>
      <p><a class="btn" href="/login">Sign In</a></p>
    </body>
    </html>
  `);
});

// GET /login — builds the SaaSKit authorize URL and redirects
app.get('/login', (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl('http://localhost:3000/callback', {
      scopes: ['openid', 'profile', 'email', 'offline_access']
    });
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).send(`Failed to generate authorize URL: ${error.message}`);
  }
});

// GET /callback — receives authorization code and exchanges it
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Authorization code is missing');
  }
  try {
    const result = await scalekit.authenticateWithCode(code, 'http://localhost:3000/callback');
    res.cookie('accessToken', result.accessToken, { httpOnly: true });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true });
    res.cookie('idToken', result.idToken, { httpOnly: true });
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error in callback:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// GET /dashboard — protected route showing token details
app.get('/dashboard', (req, res) => {
  const { accessToken, idToken } = req.cookies;
  if (!accessToken || !idToken) {
    return res.redirect('/login');
  }

  const decodedAccess = decodeJwt(accessToken);
  const decodedId = decodeJwt(idToken);

  if (!decodedAccess || !decodedId) {
    return res.redirect('/login');
  }

  const email = decodedId.email;
  const iat = decodedAccess.iat;
  const exp = decodedAccess.exp;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        body { font-family: sans-serif; margin: 40px; }
        .card { border: 1px solid #ccc; padding: 20px; border-radius: 8px; max-width: 500px; }
        .btn { display: inline-block; padding: 10px 15px; margin: 10px 5px 10px 0; background: #0070f3; color: white; text-decoration: none; border-radius: 5px; }
        .btn-danger { background: #ff0000; }
      </style>
    </head>
    <body>
      <h2>Protected Dashboard</h2>
      <div class="card">
        <p><strong>Email:</strong> <span id="user-email">${email}</span></p>
        <p>iat: <span id="token-iat">${iat}</span></p>
        <p>exp: <span id="token-exp">${exp}</span></p>
        <div>
          <a class="btn" href="/refresh-session">Refresh access token</a>
          <a class="btn btn-danger" href="/logout">Logout</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// GET /refresh-session — exchanges the refresh token
app.get('/refresh-session', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.redirect('/login');
  }

  try {
    const result = await scalekit.refreshAccessToken(refreshToken);
    res.cookie('accessToken', result.accessToken, { httpOnly: true });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true });
    if (result.idToken) {
      res.cookie('idToken', result.idToken, { httpOnly: true });
    }
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error in refresh-session:', error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    res.redirect('/login');
  }
});

// GET /logout — clears cookies and redirects to Scalekit logout
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: 'http://localhost:3000/goodbye'
  });
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  res.redirect(logoutUrl);
});

// GET /goodbye — confirmation page
app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Goodbye</title>
      <style>
        body { font-family: sans-serif; margin: 40px; }
      </style>
    </head>
    <body>
      <h2>You have been signed out</h2>
      <p>Goodbye! You have successfully logged out.</p>
      <p><a href="/">Go to Home</a></p>
    </body>
    </html>
  `);
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Application listening on port ${port}`);
});
