'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

// ---------------------------------------------------------------------------
// Scalekit SDK initialisation
// ---------------------------------------------------------------------------
const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_REDIRECT_URI = 'http://localhost:3000/goodbye';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode the payload of a JWT without cryptographic verification.
 * Returns the parsed JSON object.
 */
function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT format');
  // Base64url → base64 → Buffer → UTF-8 string
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json);
}

/** Cookie options shared across all token cookies */
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
};

/** Clear all three session cookies */
function clearSessionCookies(res) {
  res.clearCookie('accessToken', cookieOpts);
  res.clearCookie('refreshToken', cookieOpts);
  res.clearCookie('idToken', cookieOpts);
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(cookieParser());

// ---------------------------------------------------------------------------
// GET /  – Public landing page
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scalekit SSO Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f7fa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
      width: 100%;
    }
    h1 { font-size: 1.8rem; margin-bottom: 8px; color: #1a1a2e; }
    p  { color: #666; margin-bottom: 32px; font-size: .95rem; }
    .btn {
      display: inline-block;
      padding: 12px 28px;
      background: #4f46e5;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      transition: background .2s;
    }
    .btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome</h1>
    <p>Sign in with your enterprise account using Single Sign-On.</p>
    <a class="btn" href="/login">Sign in with SSO</a>
  </div>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /login  – Build the Scalekit authorize URL and redirect
// ---------------------------------------------------------------------------
app.get('/login', async (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
      scopes: SCOPES,
    });
    res.redirect(authUrl);
  } catch (err) {
    console.error('Error building authorize URL:', err);
    res.status(500).send('Failed to initiate SSO. Please try again.');
  }
});

// ---------------------------------------------------------------------------
// GET /callback  – Exchange code, set cookies, redirect to /dashboard
// ---------------------------------------------------------------------------
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.status(400).send(`Authentication error: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  try {
    const result = await scalekit.authenticateWithCode(code, REDIRECT_URI);

    const { accessToken, refreshToken, idToken } = result;

    res.cookie('accessToken', accessToken, cookieOpts);
    res.cookie('refreshToken', refreshToken, cookieOpts);
    res.cookie('idToken', idToken, cookieOpts);

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Error exchanging code:', err);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard  – Protected page showing email and oid
// ---------------------------------------------------------------------------
app.get('/dashboard', (req, res) => {
  const { idToken } = req.cookies;

  if (!idToken) {
    return res.redirect('/login');
  }

  let claims;
  try {
    claims = decodeJwtPayload(idToken);
  } catch (err) {
    console.error('Failed to decode idToken:', err);
    clearSessionCookies(res);
    return res.redirect('/login');
  }

  const email = claims.email || '(unknown)';
  const oid = claims.oid || '(unknown)';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard – Scalekit SSO Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f7fa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      padding: 48px 40px;
      max-width: 520px;
      width: 100%;
    }
    h1 { font-size: 1.6rem; margin-bottom: 24px; color: #1a1a2e; }
    .info-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 20px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .label { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; font-weight: 600; }
    .value { font-size: 1rem; color: #111827; word-break: break-all; }
    .btn {
      display: inline-block;
      margin-top: 8px;
      padding: 10px 24px;
      background: #ef4444;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: .95rem;
      font-weight: 600;
      transition: background .2s;
    }
    .btn:hover { background: #dc2626; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Dashboard</h1>
    <div class="info-row">
      <span class="label">Email</span>
      <span class="value">${escapeHtml(email)}</span>
    </div>
    <div class="info-row">
      <span class="label">Organization ID</span>
      <span class="value">${escapeHtml(oid)}</span>
    </div>
    <a class="btn" href="/logout">Sign out</a>
  </div>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// GET /logout  – Build Scalekit logout URL, clear cookies, redirect
// ---------------------------------------------------------------------------
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;

  // Build the logout URL BEFORE clearing cookies (id_token_hint is required)
  let logoutUrl;
  try {
    logoutUrl = scalekit.getLogoutUrl(idToken, POST_LOGOUT_REDIRECT_URI);
  } catch (err) {
    console.error('Error building logout URL:', err);
    // Fall back to goodbye page if we cannot build the logout URL
    clearSessionCookies(res);
    return res.redirect(POST_LOGOUT_REDIRECT_URI);
  }

  clearSessionCookies(res);
  res.redirect(logoutUrl);
});

// ---------------------------------------------------------------------------
// GET /goodbye  – Public post-logout confirmation page
// ---------------------------------------------------------------------------
app.get('/goodbye', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Signed Out – Scalekit SSO Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f7fa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
      width: 100%;
    }
    .icon { font-size: 3rem; margin-bottom: 16px; }
    h1 { font-size: 1.6rem; margin-bottom: 8px; color: #1a1a2e; }
    p  { color: #666; margin-bottom: 32px; font-size: .95rem; }
    .btn {
      display: inline-block;
      padding: 10px 24px;
      background: #4f46e5;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: .95rem;
      font-weight: 600;
      transition: background .2s;
    }
    .btn:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">👋</div>
    <h1>You have been signed out</h1>
    <p>You have successfully logged out. See you next time!</p>
    <a class="btn" href="/">Back to Home</a>
  </div>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Utility: basic HTML escaping to prevent XSS when rendering claims
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Scalekit SSO app listening on http://localhost:${PORT}`);
});
