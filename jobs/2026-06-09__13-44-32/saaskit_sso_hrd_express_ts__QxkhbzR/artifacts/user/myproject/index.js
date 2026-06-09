import express from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const app = express();
const port = 3000;

// Initialize the Scalekit SDK client using environment variables
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL || '',
  process.env.SCALEKIT_CLIENT_ID || '',
  process.env.SCALEKIT_CLIENT_SECRET || ''
);

app.use(cookieParser());

// Helper function to decode JWT claims without cryptographic verification
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1];
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to decode JWT:', err);
    return null;
  }
}

// GET / - Public landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Scalekit SSO Demo</title>
      <style>
        body { font-family: sans-serif; margin: 40px; text-align: center; }
        .container { max-width: 600px; margin: auto; padding: 40px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; }
        p { font-size: 16px; color: #666; margin-bottom: 30px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px; }
        .btn:hover { background-color: #0056b3; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome to Scalekit SSO Demo</h1>
        <p>This application demonstrates Enterprise Single Sign-On (SSO) with Home Realm Discovery (HRD) using Scalekit.</p>
        <a href="/login" class="btn">Sign in with SSO</a>
      </div>
    </body>
    </html>
  `);
});

// GET /login - Build authorize URL and redirect
app.get('/login', (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(
      'http://localhost:3000/callback',
      {
        scopes: ['openid', 'profile', 'email', 'offline_access']
      }
    );
    res.redirect(authUrl);
  } catch (err) {
    console.error('Error in /login:', err);
    res.status(500).send('Failed to initiate login: ' + err.message);
  }
});

// GET /callback - Exchange authorization code for tokens, store in HttpOnly cookies, redirect to dashboard
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`Authentication error: ${error} - ${error_description}`);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    const result = await scalekit.authenticateWithCode(
      code,
      'http://localhost:3000/callback'
    );

    // Store tokens in HttpOnly cookies
    res.cookie('accessToken', result.accessToken, { httpOnly: true, path: '/' });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, path: '/' });
    res.cookie('idToken', result.idToken, { httpOnly: true, path: '/' });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Error in /callback:', err);
    res.status(500).send('Authentication failed: ' + err.message);
  }
});

// GET /dashboard - Protected dashboard route
app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }

  const payload = decodeJwt(idToken);
  if (!payload || !payload.email || !payload.oid) {
    console.warn('Invalid token claims or payload:', payload);
    return res.redirect('/login');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        body { font-family: sans-serif; margin: 40px; }
        .container { max-width: 600px; margin: auto; padding: 30px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        p { font-size: 16px; line-height: 1.6; }
        .data-label { font-weight: bold; color: #555; }
        .data-value { font-family: monospace; background-color: #f8f9fa; padding: 2px 6px; border-radius: 4px; }
        .btn-logout { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
        .btn-logout:hover { background-color: #bd2130; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Enterprise SSO Dashboard</h1>
        <p>You have successfully authenticated via Enterprise SSO!</p>
        <p><span class="data-label">Email:</span> <span class="data-value" id="email">${payload.email}</span></p>
        <p><span class="data-label">Organization ID:</span> <span class="data-value" id="oid">${payload.oid}</span></p>
        <a href="/logout" class="btn-logout">Sign out</a>
      </div>
    </body>
    </html>
  `);
});

// GET /logout - Clear cookies and redirect to Scalekit logout endpoint
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  let logoutUrl;

  try {
    if (idToken) {
      logoutUrl = scalekit.getLogoutUrl({
        idTokenHint: idToken,
        postLogoutRedirectUri: 'http://localhost:3000/goodbye'
      });
    } else {
      logoutUrl = 'http://localhost:3000/goodbye';
    }
  } catch (err) {
    console.error('Error generating logout URL:', err);
    logoutUrl = 'http://localhost:3000/goodbye';
  }

  // Clear HttpOnly cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('idToken', { path: '/' });

  res.redirect(logoutUrl);
});

// GET /goodbye - Public goodbye page confirming signout
app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Signed Out</title>
      <style>
        body { font-family: sans-serif; margin: 40px; text-align: center; }
        .container { max-width: 600px; margin: auto; padding: 40px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #28a745; margin-bottom: 20px; }
        p { font-size: 16px; color: #666; margin-bottom: 30px; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
        .btn:hover { background-color: #0056b3; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Goodbye!</h1>
        <p>You have been successfully signed out.</p>
        <a href="/" class="btn">Go to Home</a>
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});
