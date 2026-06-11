const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// Prevent SDK background auth from crashing the process
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message || err);
});

const app = express();
const PORT = 3000;

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';

app.use(cookieParser());

// Helper: decode JWT payload (base64url) without cryptographic verification
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let payload = parts[1];
    // base64url to base64
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Pad to multiple of 4
    while (payload.length % 4 !== 0) {
      payload += '=';
    }
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

// Middleware: validate access token, attach id token claims
async function requireAuth(req, res, next) {
  const accessToken = req.cookies.accessToken || extractBearerToken(req);
  if (!accessToken) {
    return next('unauthenticated');
  }

  try {
    const valid = await scalekit.validateAccessToken(accessToken);
    if (!valid) {
      return next('unauthenticated');
    }
  } catch (e) {
    return next('unauthenticated');
  }

  const idToken = req.cookies.idToken;
  if (!idToken) {
    return next('unauthenticated');
  }

  const claims = decodeJwtPayload(idToken);
  if (!claims) {
    return next('unauthenticated');
  }

  req.user = claims;
  next();
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// GET / — public landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Scalekit SaaSKit App</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .container { text-align: center; background: white; padding: 3rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        a.btn { display: inline-block; margin-top: 1.5rem; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
        a.btn:hover { background: #4338ca; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome</h1>
        <p>Please sign in to continue.</p>
        <a href="/login" class="btn">Sign In</a>
      </div>
    </body>
    </html>
  `);
});

// GET /login — redirect to Scalekit authorize URL
app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ['openid', 'profile', 'email', 'offline_access']
  });
  res.redirect(authUrl);
});

// GET /callback — exchange code for tokens, set cookies, redirect to dashboard
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/login');
  }

  try {
    const authResponse = await scalekit.authenticateWithCode(code, REDIRECT_URI);

    // Set HttpOnly cookies
    res.cookie('accessToken', authResponse.accessToken, {
      httpOnly: true,
      path: '/'
    });
    res.cookie('refreshToken', authResponse.refreshToken || '', {
      httpOnly: true,
      path: '/'
    });
    res.cookie('idToken', authResponse.idToken, {
      httpOnly: true,
      path: '/'
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Authentication error:', err.message);
    res.redirect('/login');
  }
});

// GET /dashboard — protected HTML route
app.get('/dashboard', async (req, res, next) => {
  const accessToken = req.cookies.accessToken;
  if (!accessToken) {
    return res.redirect('/login');
  }

  try {
    const valid = await scalekit.validateAccessToken(accessToken);
    if (!valid) {
      return res.redirect('/login');
    }
  } catch (e) {
    return res.redirect('/login');
  }

  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }

  const claims = decodeJwtPayload(idToken);
  if (!claims) {
    return res.redirect('/login');
  }

  const email = claims.email || '';
  const sub = claims.sub || '';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dashboard</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .container { text-align: center; background: white; padding: 3rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); min-width: 400px; }
        h1 { color: #333; }
        .info { margin: 1.5rem 0; text-align: left; background: #f9fafb; padding: 1rem; border-radius: 6px; }
        .info p { margin: 0.5rem 0; }
        .label { font-weight: 600; color: #555; }
        a.btn { display: inline-block; margin-top: 1.5rem; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
        a.btn:hover { background: #b91c1c; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Dashboard</h1>
        <div class="info">
          <p><span class="label">Email:</span> ${escapeHtml(email)}</p>
          <p><span class="label">User ID:</span> ${escapeHtml(sub)}</p>
        </div>
        <a href="/logout" class="btn">Sign Out</a>
      </div>
    </body>
    </html>
  `);
});

// GET /api/me — protected JSON endpoint
app.get('/api/me', async (req, res) => {
  const accessToken = req.cookies.accessToken || extractBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    const valid = await scalekit.validateAccessToken(accessToken);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid access token' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.status(401).json({ error: 'Missing id token' });
  }

  const claims = decodeJwtPayload(idToken);
  if (!claims) {
    return res.status(401).json({ error: 'Invalid id token' });
  }

  res.json({
    email: claims.email,
    sub: claims.sub
  });
});

// GET /logout — generate logout URL, clear cookies, redirect
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;

  // Build logout URL before clearing cookies (need idToken for id_token_hint)
  const logoutUrl = `${process.env.SCALEKIT_ENV_URL}/oidc/logout?id_token_hint=${encodeURIComponent(idToken || '')}&post_logout_redirect_uri=${encodeURIComponent(POST_LOGOUT_URI)}`;

  // Clear all auth cookies
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('idToken', { path: '/' });

  res.redirect(logoutUrl);
});

// GET /goodbye — public sign-out confirmation page
app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Signed Out</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .container { text-align: center; background: white; padding: 3rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        p { color: #666; }
        a.btn { display: inline-block; margin-top: 1.5rem; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 1rem; }
        a.btn:hover { background: #4338ca; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>You have signed out</h1>
        <p>You have been successfully logged out. Goodbye!</p>
        <a href="/" class="btn">Sign In Again</a>
      </div>
    </body>
    </html>
  `);
});

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});