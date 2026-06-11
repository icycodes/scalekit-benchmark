require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
app.use(cookieParser());

const port = 3000;
const redirectUri = 'http://localhost:3000/callback';
const postLogoutUri = 'http://localhost:3000/goodbye';

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Welcome to Scalekit Test App</h1>
        <a href="/login">Sign In</a>
      </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(redirectUri, {
    scopes: ['openid', 'profile', 'email', 'offline_access']
  });
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No code provided');
  }
  
  try {
    const authResponse = await scalekit.authenticateWithCode(code, redirectUri);
    
    // Depending on the version, the token could be in `authResponse` or `authResponse.tokens`?
    // I will extract them directly based on standard OAuth2 response names. 
    // The requirement mentions 'stores accessToken, refreshToken, and idToken' 
    // so let's just use the properties directly, or maybe fallback.
    const accessToken = authResponse.accessToken || authResponse.access_token || (authResponse.tokens && authResponse.tokens.accessToken);
    const refreshToken = authResponse.refreshToken || authResponse.refresh_token || (authResponse.tokens && authResponse.tokens.refreshToken);
    const idToken = authResponse.idToken || authResponse.id_token || (authResponse.tokens && authResponse.tokens.idToken);
    
    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }
  
  try {
    const decoded = jwt.decode(idToken);
    const email = decoded.email || 'Unknown email';
    
    res.send(`
      <html>
        <body>
          <h1>Dashboard</h1>
          <p>Email: ${email}</p>
          <a href="/logout">Sign out</a>
        </body>
      </html>
    `);
  } catch (err) {
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/');
  }
  
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: postLogoutUri
  });
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>You have successfully signed out. Goodbye!</h1>
        <a href="/">Go to Home</a>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
