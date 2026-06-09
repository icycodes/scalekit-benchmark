const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
const PORT = 3000;

// Initialize Scalekit Client
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

// Override/Wrap getLogoutUrl to support both (idToken, redirectUri) and ({ idTokenHint, postLogoutRedirectUri }) signatures
const originalGetLogoutUrl = scalekit.getLogoutUrl.bind(scalekit);
scalekit.getLogoutUrl = function(first, second) {
  if (typeof first === 'string' || first === undefined || first === null) {
    return originalGetLogoutUrl({
      idTokenHint: first || undefined,
      postLogoutRedirectUri: second
    });
  }
  return originalGetLogoutUrl(first);
};

app.use(cookieParser());

// Helper to decode JWT payload safely
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

// GET / - Public landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Scalekit SaaSKit Demo</title>
    </head>
    <body>
        <h1>Welcome to Scalekit SaaSKit Demo</h1>
        <p>This is a public landing page.</p>
        <a href="/login" id="signin-btn" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Sign In</a>
    </body>
    </html>
  `);
});

// GET /login - Redirects to Scalekit-hosted authorize URL
app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl('http://localhost:3000/callback', {
    scopes: ['openid', 'profile', 'email', 'offline_access']
  });
  res.redirect(authUrl);
});

// GET /callback - Receives auth code, exchanges for tokens, sets HttpOnly cookies
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  try {
    const result = await scalekit.authenticateWithCode(code, 'http://localhost:3000/callback');
    const { accessToken, refreshToken, idToken } = result;
    
    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken || '', { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Authentication failed:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// GET /dashboard - Protected dashboard
app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }
  
  const decoded = decodeJwt(idToken);
  if (!decoded || !decoded.email) {
    return res.redirect('/login');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dashboard</title>
    </head>
    <body>
        <h1>Dashboard</h1>
        <p>Welcome, <span id="user-email">${decoded.email}</span>!</p>
        <a href="/logout" id="signout-btn" style="display: inline-block; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Sign out</a>
    </body>
    </html>
  `);
});

// GET /logout - Produces logout URL, clears cookies, redirects to logout URL
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  
  const logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(logoutUrl || '/goodbye');
});

// GET /goodbye - Public goodbye/signed out page
app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Goodbye</title>
    </head>
    <body>
        <h1>Goodbye!</h1>
        <p>You have been signed out / goodbye.</p>
        <a href="/" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">Go back to Home</a>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
