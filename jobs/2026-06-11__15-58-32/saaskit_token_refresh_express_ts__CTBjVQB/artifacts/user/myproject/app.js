const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
const port = 3000;

const SCALEKIT_ENV_URL = process.env.SCALEKIT_ENV_URL;
const SCALEKIT_CLIENT_ID = process.env.SCALEKIT_CLIENT_ID;
const SCALEKIT_CLIENT_SECRET = process.env.SCALEKIT_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const POST_LOGOUT_URI = 'http://localhost:3000/goodbye';

const scalekit = new ScalekitClient(SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET);

app.use(cookieParser());

// Helper: decode JWT payload (middle segment) without verification
function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = parts[1];
  // base64url decode
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}

// Helper: clear all auth cookies
function clearAuthCookies(res) {
  res.clearCookie('accessToken', { httpOnly: true });
  res.clearCookie('refreshToken', { httpOnly: true });
  res.clearCookie('idToken', { httpOnly: true });
}

// Helper: set auth cookies
function setAuthCookies(res, accessToken, refreshToken, idToken) {
  res.cookie('accessToken', accessToken, { httpOnly: true, path: '/' });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, path: '/' });
  res.cookie('idToken', idToken, { httpOnly: true, path: '/' });
}

// GET / — public landing page
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head><title>Welcome</title></head>
<body>
  <h1>Welcome</h1>
  <p><a href="/login">Sign in</a></p>
</body>
</html>`;
  res.send(html);
});

// GET /login — redirect to Scalekit authorize URL
app.get('/login', (req, res) => {
  const authorizeUrl = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scopes: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(authorizeUrl);
});

// GET /callback — exchange code for tokens
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/login');
  }
  try {
    const result = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    setAuthCookies(res, result.accessToken, result.refreshToken, result.idToken);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Authentication error:', err);
    res.redirect('/login');
  }
});

// GET /dashboard — protected route
app.get('/dashboard', (req, res) => {
  const accessToken = req.cookies.accessToken;
  const idToken = req.cookies.idToken;

  if (!accessToken || !idToken) {
    return res.redirect('/login');
  }

  try {
    const tokenPayload = decodeJwtPayload(accessToken);
    const idTokenPayload = decodeJwtPayload(idToken);

    const email = idTokenPayload.email || 'Unknown';
    const iat = tokenPayload.iat;
    const exp = tokenPayload.exp;

    const html = `<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
  <h1>Dashboard</h1>
  <p>Email: ${email}</p>
  <p>iat: ${iat}</p>
  <p>exp: ${exp}</p>
  <p><a href="/refresh-session">Refresh access token</a></p>
  <p><a href="/logout">Sign out</a></p>
</body>
</html>`;
    res.send(html);
  } catch (err) {
    console.error('Token decode error:', err);
    clearAuthCookies(res);
    res.redirect('/login');
  }
});

// GET /refresh-session — refresh the access token
app.get('/refresh-session', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.redirect('/login');
  }

  try {
    const result = await scalekit.refreshAccessToken(refreshToken);

    // refreshAccessToken returns { accessToken, refreshToken }
    // idToken may not be returned by the refresh endpoint; keep existing idToken if not returned
    const newAccessToken = result.accessToken;
    const newRefreshToken = result.refreshToken;
    const existingIdToken = req.cookies.idToken || '';

    setAuthCookies(res, newAccessToken, newRefreshToken, existingIdToken);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Token refresh error:', err);
    clearAuthCookies(res);
    res.redirect('/login');
  }
});

// GET /logout — generate logout URL and clear cookies
app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;

  // Generate the logout URL BEFORE clearing cookies (need idToken for id_token_hint)
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken || '',
    postLogoutRedirectUri: POST_LOGOUT_URI,
  });

  // Clear all auth cookies
  clearAuthCookies(res);

  res.redirect(logoutUrl);
});

// GET /goodbye — public sign-out confirmation page
app.get('/goodbye', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head><title>Goodbye</title></head>
<body>
  <h1>You have signed out</h1>
  <p>Goodbye! You have been successfully logged out.</p>
  <p><a href="/">Sign in again</a></p>
</body>
</html>`;
  res.send(html);
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});