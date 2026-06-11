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

function decodeJwt(token) {
  if (!token) return {};
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (e) {
    return {};
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

app.get('/login', async (req, res) => {
  try {
    const url = scalekit.getAuthorizationUrl(
      redirectUri,
      {
        scopes: ['openid', 'profile', 'email', 'offline_access']
      }
    );
    res.redirect(url);
  } catch (error) {
    res.status(500).send('Error generating auth url');
  }
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const authData = await scalekit.authenticateWithCode(code, redirectUri);

    const { accessToken, refreshToken, idToken } = authData;

    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });

    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Error during authentication');
  }
});

async function requireAuth(req, res, next) {
  let token = req.cookies.accessToken;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  const isApi = req.path.startsWith('/api/');

  if (!token) {
    return isApi ? res.status(401).json({ error: 'Missing access token' }) : res.redirect('/login');
  }

  try {
    const isValid = await scalekit.validateAccessToken(token);
    if (!isValid) {
      return isApi ? res.status(401).json({ error: 'Invalid access token' }) : res.redirect('/login');
    }
    next();
  } catch (error) {
    return isApi ? res.status(401).json({ error: 'Invalid access token' }) : res.redirect('/login');
  }
}

app.get('/dashboard', requireAuth, async (req, res) => {
  const idToken = req.cookies.idToken;
  const claims = decodeJwt(idToken);

  res.send(`
    <html>
      <body>
        <h1>Dashboard</h1>
        <p>Email: ${claims.email}</p>
        <p>User ID: ${claims.sub}</p>
        <a href="/logout">Sign out</a>
      </body>
    </html>
  `);
});

app.get('/api/me', requireAuth, async (req, res) => {
  const idToken = req.cookies.idToken;
  const claims = decodeJwt(idToken);

  res.status(200).json({
    email: claims.email,
    sub: claims.sub
  });
});

app.get('/logout', async (req, res) => {
  const idToken = req.cookies.idToken;
  let url = 'http://localhost:3000/goodbye';
  try {
    if (idToken) {
      url = scalekit.getLogoutUrl({
        idTokenHint: idToken,
        postLogoutRedirectUri: 'http://localhost:3000/goodbye'
      });
    }
  } catch (e) {
    console.error('Error getting logout URL', e);
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(url);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>You have been signed out. Goodbye!</h1>
      </body>
    </html>
  `);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Server is running on port ' + PORT);
});
