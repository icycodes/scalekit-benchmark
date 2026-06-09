const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const PORT = 3000;
const CALLBACK_URL = 'http://localhost:3000/callback';
const POST_LOGOUT_URL = 'http://localhost:3000/goodbye';
const REQUIRED_SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const SESSION_COOKIE_NAMES = ['accessToken', 'refreshToken', 'idToken'];

const app = express();
app.use(cookieParser());

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET,
);

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing JWT');
  }

  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('JWT payload segment is missing');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function setTokenCookie(res, name, value) {
  if (value) {
    res.cookie(name, value, cookieOptions);
  }
}

function setSessionCookies(res, tokens, existingIdToken) {
  setTokenCookie(res, 'accessToken', tokens.accessToken);
  setTokenCookie(res, 'refreshToken', tokens.refreshToken);
  setTokenCookie(res, 'idToken', tokens.idToken || existingIdToken);
}

function clearSessionCookies(res) {
  for (const name of SESSION_COOKIE_NAMES) {
    res.clearCookie(name, cookieOptions);
  }
}

function hasRequiredEnv() {
  return Boolean(process.env.SCALEKIT_ENV_URL && process.env.SCALEKIT_CLIENT_ID && process.env.SCALEKIT_CLIENT_SECRET);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNextIssuedAtSecond(currentAccessToken) {
  try {
    const { iat } = decodeJwtPayload(currentAccessToken);
    const currentIat = Number(iat);
    if (!Number.isFinite(currentIat)) {
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds <= currentIat) {
      await sleep(Math.min((currentIat - nowSeconds + 1) * 1000, 2000));
    }
  } catch (_error) {
    // A malformed existing access token should not block trying the refresh token.
  }
}

function getScalekitLogoutUrl(idToken, postLogoutRedirectUri) {
  const legacyStyleUrl = scalekit.getLogoutUrl(idToken, postLogoutRedirectUri);
  try {
    const parsed = new URL(legacyStyleUrl);
    if (parsed.searchParams.get('id_token_hint') && parsed.searchParams.get('post_logout_redirect_uri')) {
      return legacyStyleUrl;
    }
  } catch (_error) {
    // Fall through to the object-shaped SDK call used by current @scalekit-sdk/node versions.
  }

  return scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri,
  });
}

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Scalekit SaaSKit Token Refresh Demo</title>
  </head>
  <body>
    <main>
      <h1>Scalekit SaaSKit Token Refresh Demo</h1>
      <p>This Express.js app signs you in with Scalekit and lets you explicitly refresh the access token.</p>
      <p><a href="/login">Sign in</a></p>
    </main>
  </body>
</html>`);
});

app.get('/login', (_req, res) => {
  if (!hasRequiredEnv()) {
    return res.status(500).type('text').send('Scalekit environment variables are not configured.');
  }

  const authorizationUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
    scopes: REQUIRED_SCOPES,
  });

  return res.redirect(302, authorizationUrl);
});

app.get('/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code) {
    clearSessionCookies(res);
    return res.redirect(302, '/login');
  }

  try {
    const tokens = await scalekit.authenticateWithCode(code, CALLBACK_URL);
    if (!tokens.accessToken || !tokens.refreshToken || !tokens.idToken) {
      throw new Error('Scalekit did not return the required tokens');
    }

    setSessionCookies(res, tokens);
    return res.redirect(302, '/dashboard');
  } catch (error) {
    console.error('Authentication callback failed:', error);
    clearSessionCookies(res);
    return res.redirect(302, '/login');
  }
});

app.get('/dashboard', (req, res) => {
  const { accessToken, idToken } = req.cookies;
  if (!accessToken || !idToken) {
    return res.redirect(302, '/login');
  }

  try {
    const accessClaims = decodeJwtPayload(accessToken);
    const idClaims = decodeJwtPayload(idToken);
    const iat = Number(accessClaims.iat);
    const exp = Number(accessClaims.exp);
    const email = idClaims.email;

    if (!email || !Number.isInteger(iat) || !Number.isInteger(exp)) {
      throw new Error('Required token claims are missing');
    }

    return res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dashboard</title>
  </head>
  <body>
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as: <strong>${escapeHtml(email)}</strong></p>
      <section aria-label="Access token claims">
        <h2>Access token claims</h2>
        <p>iat: <strong>${iat}</strong></p>
        <p>exp: <strong>${exp}</strong></p>
      </section>
      <nav>
        <p><a href="/refresh-session">Refresh access token</a></p>
        <p><a href="/logout">Sign out</a></p>
      </nav>
    </main>
  </body>
</html>`);
  } catch (error) {
    console.error('Dashboard token decode failed:', error);
    clearSessionCookies(res);
    return res.redirect(302, '/login');
  }
});

app.get('/refresh-session', async (req, res) => {
  const { accessToken, refreshToken, idToken } = req.cookies;
  if (!refreshToken) {
    return res.redirect(302, '/login');
  }

  try {
    await waitForNextIssuedAtSecond(accessToken);
    const tokens = await scalekit.refreshAccessToken(refreshToken);
    if (!tokens || !tokens.accessToken || !tokens.refreshToken) {
      throw new Error('Scalekit did not return a valid refreshed token pair');
    }

    setSessionCookies(res, tokens, idToken);
    return res.redirect(302, '/dashboard');
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearSessionCookies(res);
    return res.redirect(302, '/login');
  }
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  let logoutUrl;

  try {
    logoutUrl = getScalekitLogoutUrl(idToken, POST_LOGOUT_URL);
  } catch (error) {
    console.error('Logout URL generation failed:', error);
    logoutUrl = POST_LOGOUT_URL;
  }

  clearSessionCookies(res);
  return res.redirect(302, logoutUrl);
});

app.get('/goodbye', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Signed out</title>
  </head>
  <body>
    <main>
      <h1>Goodbye</h1>
      <p>You are signed out.</p>
      <p><a href="/">Return to the landing page</a></p>
    </main>
  </body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Scalekit SaaSKit demo listening on http://localhost:${PORT}`);
});
