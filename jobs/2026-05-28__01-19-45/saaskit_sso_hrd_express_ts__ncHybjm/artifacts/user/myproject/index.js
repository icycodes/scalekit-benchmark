const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
app.use(cookieParser());

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL || '',
  process.env.SCALEKIT_CLIENT_ID || '',
  process.env.SCALEKIT_CLIENT_SECRET || ''
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Home</title></head>
      <body>
        <h1>Welcome</h1>
        <a href="/login">Sign in with SSO</a>
      </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  try {
    const authorizeUrl = scalekit.getAuthorizationUrl(
      REDIRECT_URI,
      {
        scopes: ['openid', 'profile', 'email', 'offline_access']
      }
    );
    res.redirect(authorizeUrl);
  } catch (err) {
    res.status(500).send('Error generating authorize URL: ' + err.message);
  }
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const tokenResponse = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    
    const cookieOptions = {
      httpOnly: true,
      secure: false, // localhost
      sameSite: 'lax'
    };

    res.cookie('accessToken', tokenResponse.accessToken, cookieOptions);
    res.cookie('refreshToken', tokenResponse.refreshToken, cookieOptions);
    res.cookie('idToken', tokenResponse.idToken, cookieOptions);

    res.redirect('/dashboard');
  } catch (err) {
    res.status(500).send('Error authenticating: ' + err.message);
  }
});

app.get('/dashboard', (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    return res.redirect('/login');
  }

  try {
    const payloadBase64 = idToken.split('.')[1];
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Dashboard</title></head>
        <body>
          <h1>Dashboard</h1>
          <p>Email: ${payload.email}</p>
          <p>Organization ID: ${payload.oid}</p>
          <a href="/logout">Sign out</a>
        </body>
      </html>
    `);
  } catch (err) {
    res.clearCookie('idToken');
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;
  
  let logoutUrl;
  try {
    // Some versions or hint suggests two strings, but SDK source says it takes an object.
    // Let's pass an object as per the SDK source.
    logoutUrl = scalekit.getLogoutUrl({
      idTokenHint: idToken,
      postLogoutRedirectUri: POST_LOGOUT_URI
    });
  } catch (err) {
    logoutUrl = '/goodbye';
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  if (logoutUrl) {
    res.redirect(logoutUrl);
  } else {
    res.redirect('/goodbye');
  }
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Goodbye</title></head>
      <body>
        <h1>You have been signed out. Goodbye!</h1>
      </body>
    </html>
  `);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
