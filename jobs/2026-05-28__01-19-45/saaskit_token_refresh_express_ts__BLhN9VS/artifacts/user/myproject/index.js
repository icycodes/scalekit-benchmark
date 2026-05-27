const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

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

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

app.get('/', (req, res) => {
  res.send('<h1>Welcome</h1><a href="/login">Sign in</a>');
});

app.get('/login', (req, res) => {
  const url = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scope: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
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
    console.error('Authentication failed:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', (req, res) => {
  const { accessToken, idToken } = req.cookies;

  if (!accessToken || !idToken) {
    return res.redirect('/login');
  }

  const accessPayload = decodeJwt(accessToken);
  const idPayload = decodeJwt(idToken);

  if (!accessPayload || !idPayload) {
    return res.redirect('/login');
  }

  res.send('<h1>Dashboard</h1>' +
    '<p>Email: ' + idPayload.email + '</p>' +
    '<p>iat: ' + accessPayload.iat + '</p>' +
    '<p>exp: ' + accessPayload.exp + '</p>' +
    '<a href="/refresh-session">Refresh access token</a><br><br>' +
    '<a href="/logout">Logout</a>');
});

app.get('/refresh-session', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.redirect('/login');
  }

  try {
    const result = await scalekit.refreshAccessToken(refreshToken);
    const { accessToken, refreshToken: newRefreshToken, idToken } = result;

    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', newRefreshToken, { httpOnly: true });
    if (idToken) {
      res.cookie('idToken', idToken, { httpOnly: true });
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Refresh failed:', error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;
  
  let logoutUrl = '/goodbye';
  if (idToken) {
    logoutUrl = scalekit.getLogoutUrl(idToken, POST_LOGOUT_REDIRECT_URI);
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send('<h1>You have signed out</h1><p>Goodbye!</p><a href="/">Go to Home</a>');
});

app.listen(port, () => {
  console.log('App listening at http://localhost:' + port);
});
