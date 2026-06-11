const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
const port = 3000;

app.use(cookieParser());

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const redirectUri = 'http://localhost:3000/callback';

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch(e) {
    return null;
  }
}

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
  const url = scalekit.getAuthorizationUrl(
    redirectUri,
    {
      scopes: ['openid', 'profile', 'email', 'offline_access']
    }
  );
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('No code provided');
  }
  
  try {
    const { accessToken, refreshToken, idToken } = await scalekit.authenticateWithCode(code, redirectUri);
    
    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', (req, res) => {
  const { accessToken, idToken } = req.cookies;
  
  if (!accessToken || !idToken) {
    return res.redirect('/login');
  }
  
  const decodedAccess = parseJwt(accessToken);
  const decodedId = parseJwt(idToken);
  
  if (!decodedAccess || !decodedId) {
    return res.redirect('/login');
  }
  
  res.send(`
    <html>
      <body>
        <h1>Dashboard</h1>
        <p>Email: ${decodedId.email}</p>
        <p>iat: ${decodedAccess.iat}</p>
        <p>exp: ${decodedAccess.exp}</p>
        <a href="/refresh-session">Refresh access token</a>
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
    
    res.cookie('accessToken', result.accessToken, { httpOnly: true });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true });
    if (result.idToken) {
        res.cookie('idToken', result.idToken, { httpOnly: true });
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;
  
  let logoutUrl;
  try {
    // Try passing as object first
    logoutUrl = scalekit.getLogoutUrl({
      idTokenHint: idToken,
      postLogoutRedirectUri: 'http://localhost:3000/goodbye'
    });
  } catch (e) {
    // Fallback if the prompt's signature was literal
    logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
  }
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Goodbye</h1>
        <p>You have successfully signed out.</p>
        <a href="/">Go home</a>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
