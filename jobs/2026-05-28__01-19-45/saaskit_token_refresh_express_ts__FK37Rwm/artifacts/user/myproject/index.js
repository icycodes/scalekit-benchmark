const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
app.use(cookieParser());

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const redirectUri = 'http://localhost:3000/callback';

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Home</title></head>
      <body>
        <h1>Welcome to SaaSKit</h1>
        <a href="/login">Sign in</a>
      </body>
    </html>
  `);
});

app.get('/login', async (req, res) => {
  try {
    const url = await scalekit.getAuthorizationUrl(redirectUri, {
      scopes: ['openid', 'profile', 'email', 'offline_access']
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('No code provided');
  }
  
  try {
    const result = await scalekit.authenticateWithCode(code, redirectUri);
    const { accessToken, refreshToken, idToken } = result;
    
    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });
    
    res.redirect('/dashboard');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

app.get('/dashboard', (req, res) => {
  const { accessToken, idToken } = req.cookies;
  if (!accessToken || !idToken) {
    return res.redirect('/login');
  }
  
  const accessPayload = decodeJwt(accessToken) || {};
  const idPayload = decodeJwt(idToken) || {};
  
  const email = idPayload.email || 'Unknown';
  const iat = accessPayload.iat;
  const exp = accessPayload.exp;
  
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Dashboard</title></head>
      <body>
        <h1>Dashboard</h1>
        <p>Email: ${email}</p>
        <p>iat: ${iat}</p>
        <p>exp: ${exp}</p>
        <a href="/refresh-session">Refresh access token</a>
        <br/>
        <br/>
        <a href="/logout">Sign out</a>
      </body>
    </html>
  `);
});

app.get('/refresh-session', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.redirect('/login');
  }
  
  try {
    const result = await scalekit.refreshAccessToken(refreshToken);
    if (result.accessToken) {
      res.cookie('accessToken', result.accessToken, { httpOnly: true });
    }
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true });
    }
    if (result.idToken) {
      res.cookie('idToken', result.idToken, { httpOnly: true });
    }
    res.redirect('/dashboard');
  } catch (err) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;
  const postLogoutRedirectUri = 'http://localhost:3000/goodbye';
  
  let logoutUrl = '/goodbye';
  if (idToken) {
    try {
      // The prompt suggests scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye')
      // However the SDK expects an options object. We will use the object to ensure it works properly.
      logoutUrl = scalekit.getLogoutUrl({ idTokenHint: idToken, postLogoutRedirectUri });
    } catch (err) {
      console.error('Error generating logout URL:', err);
    }
  }
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Goodbye</title></head>
      <body>
        <h1>You have been signed out.</h1>
      </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
