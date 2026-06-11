const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message || err);
});

const app = express();
const PORT = 3000;

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';

app.use(cookieParser());

// Helper: decode JWT payload (no verification needed per requirements)
function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  const payload = parts[1];
  // base64url decode
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json);
}

// GET / — public landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Scalekit SSO App</title></head>
    <body>
      <h1>Welcome</h1>
      <p>Sign in with your enterprise SSO account.</p>
      <a href="/login">Sign in with SSO</a>
    </body>
    </html>
  `);
});

// GET /login — redirect to Scalekit authorize URL
app.get('/login', (req, res) => {
  const authorizeUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ['openid', 'profile', 'email', 'offline_access']
  });
  res.redirect(authorizeUrl);
});

// GET /callback — exchange code, set cookies, redirect to dashboard
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/login');
  }

  try {
    const authResponse = await scalekit.authenticateWithCode(code, REDIRECT_URI);

    // Set HttpOnly cookies
    res.cookie('accessToken', authResponse.accessToken, {
      httpOnly: true,
      path: '/'
    });
    res.cookie('refreshToken', '', {
      httpOnly: true,
      path: '/'
    });
    res.cookie('idToken', authResponse.idToken, {
      httpOnly: true,
      path: '/'
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Authentication error:', err);
    res.redirect('/login');
  }
});

// GET /dashboard — protected route
app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;

  if (!idToken) {
    return res.redirect('/login');
  }

  try {
    const claims = decodeJwtPayload(idToken);
    const email = claims.email || 'Unknown';
    const oid = claims.oid || 'Unknown';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Dashboard</title></head>
      <body>
        <h1>Dashboard</h1>
        <p>Email: ${email}</p>
        <p>Organization ID: ${oid}</p>
        <a href="/logout">Sign out</a>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Token decode error:', err);
    res.redirect('/login');
  }
});

// GET /logout — redirect to Scalekit logout URL
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;

  // Build logout URL before clearing cookies (id_token_hint required)
  const logoutUrl = `${process.env.SCALEKIT_ENV_URL}/oidc/logout?id_token_hint=${encodeURIComponent(idToken)}&post_logout_redirect_uri=${encodeURIComponent(POST_LOGOUT_URI)}`;

  // Clear cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('idToken', { path: '/' });

  res.redirect(logoutUrl);
});

// GET /goodbye — public sign-out confirmation page
app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Goodbye</title></head>
    <body>
      <h1>You have signed out</h1>
      <p>Goodbye! You have been successfully logged out.</p>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});