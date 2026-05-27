const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
app.use(cookieParser());

const port = 3000;

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
        <a href="/login">Sign in</a>
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
  try {
    const code = req.query.code;
    const { accessToken, refreshToken, idToken } = await scalekit.authenticateWithCode(code, redirectUri);
    
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
  } catch (error) {
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/');
  }

  const postLogoutRedirectUri = 'http://localhost:3000/goodbye';
  
  // The SDK uses an options object: { idTokenHint, postLogoutRedirectUri }
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: postLogoutRedirectUri
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
        <h1>Goodbye! You have been signed out.</h1>
        <a href="/">Home</a>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
