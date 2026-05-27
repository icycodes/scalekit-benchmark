const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_REDIRECT_URI = 'http://localhost:3000/goodbye';

app.use(cookieParser());

// GET / — a public landing page
app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to SaaSKit App</h1>
    <a href="/login"><button>Sign In</button></a>
  `);
});

// GET /login — redirects to Scalekit hosted login
app.get('/login', async (req, res) => {
  const url = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(url);
});

// GET /callback — receives auth code and exchanges for tokens
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    const { accessToken, refreshToken, idToken } = result;

    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// GET /dashboard — protected route
app.get('/dashboard', (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    return res.redirect('/login');
  }

  try {
    const user = jwt.decode(idToken);
    if (!user || !user.email) {
      return res.redirect('/login');
    }

    res.send(`
      <h1>Dashboard</h1>
      <p>Logged in as: <strong>${user.email}</strong></p>
      <a href="/logout"><button>Sign out</button></a>
    `);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/login');
  }
});

// GET /logout — clears cookies and redirects to Scalekit logout
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    return res.redirect('/');
  }

  const logoutUrl = scalekit.getLogoutUrl(idToken, POST_LOGOUT_REDIRECT_URI);

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  res.redirect(logoutUrl);
});

// GET /goodbye — public goodbye page
app.get('/goodbye', (req, res) => {
  res.send(`
    <h1>Goodbye!</h1>
    <p>You have been successfully signed out.</p>
    <a href="/">Back to Home</a>
  `);
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
