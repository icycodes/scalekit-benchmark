const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
const port = 3000;

// Initialize Scalekit Client
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

app.use(cookieParser());
app.use(express.json());

const REDIRECT_URI = 'http://localhost:3000/callback';

// Helper to decode JWT payload without verification
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString()
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Middleware for token validation
async function validateTokenMiddleware(req, res, next) {
  const accessToken = req.cookies.accessToken || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!accessToken) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Access token missing' });
    }
    return res.redirect('/login');
  }

  try {
    const isValid = await scalekit.validateAccessToken(accessToken);
    if (!isValid) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Invalid access token' });
      }
      return res.redirect('/login');
    }
    next();
  } catch (error) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Token validation failed' });
    }
    return res.redirect('/login');
  }
}

// Public landing page
app.get('/', (req, res) => {
  res.send('<h1>Welcome to Scalekit SaaSKit Demo</h1><a href="/login"><button>Sign In</button></a>');
});

// Login route
app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scope: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(authUrl);
});

// Callback route
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Code missing');
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

// Protected dashboard
app.get('/dashboard', validateTokenMiddleware, (req, res) => {
  const idToken = req.cookies.idToken;
  const claims = decodeJwt(idToken);

  if (!claims) {
    return res.redirect('/login');
  }

  res.send('<h1>Dashboard</h1><p>Email: ' + claims.email + '</p><p>User ID: ' + claims.sub + '</p><a href="/logout"><button>Logout</button></a>');
});

// Protected JSON API
app.get('/api/me', validateTokenMiddleware, (req, res) => {
  const idToken = req.cookies.idToken;
  const claims = decodeJwt(idToken);

  if (!claims) {
    return res.status(401).json({ error: 'ID token missing or invalid' });
  }

  res.json({
    email: claims.email,
    sub: claims.sub
  });
});

// Logout route
app.get('/logout', async (req, res) => {
  const idToken = req.cookies.idToken;
  const postLogoutRedirectUri = 'http://localhost:3000/goodbye';

  let logoutUrl = postLogoutRedirectUri;
  if (idToken) {
    try {
      logoutUrl = scalekit.getLogoutUrl(idToken, postLogoutRedirectUri);
    } catch (error) {
      console.error('Error generating logout URL:', error);
    }
  }

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  res.redirect(logoutUrl);
});

// Goodbye page
app.get('/goodbye', (req, res) => {
  res.send('<h1>Logged Out</h1><p>You have been signed out. Goodbye!</p><a href="/">Go to Home</a>');
});

app.listen(port, () => {
  console.log('App listening at http://localhost:' + port);
});
