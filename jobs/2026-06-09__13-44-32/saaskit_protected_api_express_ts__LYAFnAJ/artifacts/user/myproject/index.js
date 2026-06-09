import express from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const app = express();
const port = 3000;

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const envUrl = process.env.SCALEKIT_ENV_URL;
const clientId = process.env.SCALEKIT_CLIENT_ID;
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

if (!envUrl || !clientId || !clientSecret) {
  console.error('Error: Missing Scalekit environment variables.');
  process.exit(1);
}

const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

// Override getLogoutUrl to support both object and positional arguments
const originalGetLogoutUrl = scalekit.getLogoutUrl.bind(scalekit);
scalekit.getLogoutUrl = function(optionsOrIdToken, postLogoutRedirectUri) {
  if (typeof optionsOrIdToken === 'string') {
    return originalGetLogoutUrl({
      idTokenHint: optionsOrIdToken,
      postLogoutRedirectUri: postLogoutRedirectUri
    });
  }
  return originalGetLogoutUrl(optionsOrIdToken);
};

// Helper to decode JWT
function decodeJwt(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64Url = parts[1];
    const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
    return JSON.parse(payloadStr);
  } catch (err) {
    console.error('Error decoding JWT:', err);
    return null;
  }
}

// Authentication middleware
async function authMiddleware(req, res, next) {
  const accessToken = (req.cookies && req.cookies.accessToken) || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
  
  if (!accessToken) {
    return handleAuthFailure(req, res);
  }
  
  try {
    const isValid = await scalekit.validateAccessToken(accessToken);
    if (!isValid) {
      return handleAuthFailure(req, res);
    }
    
    // Token is valid! Let's decode the idToken and attach user to req
    const idToken = req.cookies && req.cookies.idToken;
    let decoded = decodeJwt(idToken);
    if (!decoded) {
      decoded = decodeJwt(accessToken);
    }
    
    if (!decoded) {
      return handleAuthFailure(req, res);
    }
    
    req.user = {
      email: decoded.email,
      sub: decoded.sub
    };
    next();
  } catch (error) {
    console.error('Validation error:', error);
    return handleAuthFailure(req, res);
  }
}

function handleAuthFailure(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized or invalid token' });
  } else {
    return res.redirect('/login');
  }
}

// Routes
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SaaSKit App Landing</title>
    </head>
    <body>
        <h1>Welcome to SaaSKit App</h1>
        <p>Please sign in to access your dashboard.</p>
        <a id="signin-btn" href="/login" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Sign In</a>
    </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(
    'http://localhost:3000/callback',
    {
      scopes: ['openid', 'profile', 'email', 'offline_access']
    }
  );
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing code parameter');
  }
  
  try {
    const result = await scalekit.authenticateWithCode(
      code,
      'http://localhost:3000/callback'
    );
    
    res.cookie('accessToken', result.accessToken, { httpOnly: true, secure: false });
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: false });
    }
    if (result.idToken) {
      res.cookie('idToken', result.idToken, { httpOnly: true, secure: false });
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', authMiddleware, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dashboard</title>
    </head>
    <body>
        <h1>Dashboard</h1>
        <p>Welcome back!</p>
        <div>
            <h3>Server-side Rendered:</h3>
            <p>Email: <span id="user-email">${req.user.email}</span></p>
            <p>User ID: <span id="user-sub">${req.user.sub}</span></p>
        </div>
        <div id="api-data" style="margin-top: 20px; border: 1px solid #ccc; padding: 10px; max-width: 400px;">
            <h3>Fetched from /api/me:</h3>
            <p>Loading...</p>
        </div>
        <br/>
        <a id="logout-btn" href="/logout" style="padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Sign out</a>

        <script>
            fetch('/api/me')
                .then(res => res.json())
                .then(data => {
                    const apiDataDiv = document.getElementById('api-data');
                    if (data.error) {
                        apiDataDiv.innerHTML = '<h3>Fetched from /api/me:</h3><p style="color: red;">Error: ' + data.error + '</p>';
                    } else {
                        apiDataDiv.innerHTML = '<h3>Fetched from /api/me:</h3>' +
                            '<p>Email: <span id="api-email">' + data.email + '</span></p>' +
                            '<p>User ID: <span id="api-sub">' + data.sub + '</span></p>';
                    }
                })
                .catch(err => {
                    console.error(err);
                    document.getElementById('api-data').innerHTML = '<p style="color: red;">Failed to fetch API</p>';
                });
        </script>
    </body>
    </html>
  `);
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({
    email: req.user.email,
    sub: req.user.sub
  });
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies && req.cookies.idToken;
  
  // Produce the Scalekit logout URL BEFORE clearing cookies
  const logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Goodbye</title>
    </head>
    <body>
        <h1>Logged Out</h1>
        <p>You have been successfully signed out. Goodbye!</p>
        <a href="/">Go to Home</a>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
