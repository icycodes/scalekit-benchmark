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
    <html>
      <body>
        <h1>Welcome</h1>
        <a href="/login">Sign in with SSO</a>
      </body>
    </html>
  `);
});

app.get('/login', async (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(redirectUri, {
      scopes: ['openid', 'profile', 'email', 'offline_access']
    });
    res.redirect(authUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating login URL');
  }
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const tokens = await scalekit.authenticateWithCode(code, redirectUri);
    
    res.cookie('accessToken', tokens.accessToken, { httpOnly: true });
    res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true });
    res.cookie('idToken', tokens.idToken, { httpOnly: true });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error authenticating');
  }
});

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }

  const payload = decodeJwt(idToken);
  if (!payload) {
    return res.redirect('/login');
  }

  res.send(`
    <html>
      <body>
        <h1>Dashboard</h1>
        <p>Email: ${payload.email}</p>
        <p>Organization ID: ${payload.oid}</p>
        <a href="/logout">Sign out</a>
      </body>
    </html>
  `);
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/goodbye');
  }

  try {
    // The SDK expects postLogoutRedirectUri
    const logoutUrl = scalekit.getLogoutUrl({
      idTokenHint: idToken,
      postLogoutRedirectUri: 'http://localhost:3000/goodbye'
    });
    
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    
    res.redirect(logoutUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating logout URL');
  }
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>You have been successfully signed out. Goodbye!</h1>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
