const express = require('express');
const { ScalekitClient } = require('@scalekit-sdk/node');
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';

app.use(cookieParser());

function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[1];
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(decoded);
}

app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to SaaSKit App</h1>
    <a href="/login"><button>Sign in with SSO</button></a>
  `);
});

app.get('/login', (req, res) => {
  const url = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scope: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing code');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    const { accessToken, refreshToken, idToken } = result;

    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Authentication failed', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }

  const user = decodeJwt(idToken);
  if (!user) {
    return res.redirect('/login');
  }

  res.send(`
    <h1>Dashboard</h1>
    <p>Email: ${user.email}</p>
    <p>Organization ID: ${user.oid}</p>
    <a href="/logout"><button>Sign out</button></a>
  `);
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/');
  }

  const logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <h1>You have been signed out</h1>
    <p>Goodbye!</p>
    <a href="/">Go back home</a>
  `);
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
