const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
const PORT = 3000;
const CALLBACK_URL = 'http://localhost:3000/callback';
const POST_LOGOUT_URL = 'http://localhost:3000/goodbye';
const SCOPES = ['openid', 'profile', 'email', 'offline_access'];

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL || '',
  process.env.SCALEKIT_CLIENT_ID || '',
  process.env.SCALEKIT_CLIENT_SECRET || ''
);

app.use(cookieParser());

const tokenCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
};

function requireScalekitConfig() {
  const missing = ['SCALEKIT_ENV_URL', 'SCALEKIT_CLIENT_ID', 'SCALEKIT_CLIENT_SECRET'].filter(
    (name) => !process.env[name]
  );

  if (missing.length > 0) {
    const error = new Error(`Missing Scalekit configuration: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== 'string') {
    throw new Error('Missing JWT');
  }

  const parts = jwt.split('.');
  if (parts.length < 2 || !parts[1]) {
    throw new Error('Invalid JWT format');
  }

  const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payloadJson);
}

function clearTokenCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('idToken', { path: '/' });
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 3rem; line-height: 1.5; color: #172033; }
      main { max-width: 760px; margin: 0 auto; }
      a.button, button { display: inline-block; padding: 0.75rem 1rem; border-radius: 0.5rem; background: #3158ff; color: white; text-decoration: none; font-weight: 700; border: 0; cursor: pointer; }
      .card { border: 1px solid #d9deea; border-radius: 0.75rem; padding: 1.25rem; background: #fbfcff; }
      code { background: #eef1f8; padding: 0.15rem 0.35rem; border-radius: 0.25rem; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

app.get('/', (req, res) => {
  res.type('html').send(
    page(
      'Scalekit Enterprise SSO Demo',
      `<h1>Scalekit Enterprise SSO Demo</h1>
       <p>Use Scalekit SaaSKit hosted login to sign in through Enterprise SSO with Home Realm Discovery.</p>
       <p><a class="button" href="/login">Sign in with SSO</a></p>`
    )
  );
});

app.get('/login', (req, res, next) => {
  try {
    requireScalekitConfig();
    const authorizeUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
      scopes: SCOPES,
    });

    res.redirect(302, authorizeUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/callback', async (req, res, next) => {
  try {
    requireScalekitConfig();

    if (req.query.error) {
      return res
        .status(400)
        .type('html')
        .send(
          page(
            'Authentication error',
            `<h1>Authentication error</h1>
             <p>Scalekit returned an error: <code>${escapeHtml(req.query.error)}</code></p>
             <p>${escapeHtml(req.query.error_description || '')}</p>
             <p><a href="/login">Try again</a></p>`
          )
        );
    }

    const code = req.query.code;
    if (!code || typeof code !== 'string') {
      return res.status(400).type('html').send(page('Missing code', '<h1>Missing authorization code</h1>'));
    }

    const authResult = await scalekit.authenticateWithCode(code, CALLBACK_URL);

    res.cookie('accessToken', authResult.accessToken, tokenCookieOptions);
    res.cookie('refreshToken', authResult.refreshToken, tokenCookieOptions);
    res.cookie('idToken', authResult.idToken, tokenCookieOptions);
    res.redirect(302, '/dashboard');
  } catch (error) {
    next(error);
  }
});

app.get('/dashboard', (req, res) => {
  const idToken = req.cookies.idToken;

  if (!idToken) {
    return res.redirect(302, '/login');
  }

  let claims;
  try {
    claims = decodeJwtPayload(idToken);
  } catch (error) {
    clearTokenCookies(res);
    return res.redirect(302, '/login');
  }

  const email = claims.email || '(email claim missing)';
  const organizationId = claims.oid || '(oid claim missing)';

  res.type('html').send(
    page(
      'Dashboard',
      `<h1>Protected dashboard</h1>
       <div class="card">
         <p><strong>Signed-in email:</strong> <span id="user-email">${escapeHtml(email)}</span></p>
         <p><strong>Scalekit organization id:</strong> <span id="organization-id">${escapeHtml(organizationId)}</span></p>
       </div>
       <p><a class="button" href="/logout">Sign out</a></p>`
    )
  );
});

app.get('/logout', (req, res, next) => {
  try {
    requireScalekitConfig();

    const idToken = req.cookies.idToken;
    let logoutUrl = POST_LOGOUT_URL;

    if (idToken) {
      logoutUrl = scalekit.getLogoutUrl({
        idTokenHint: idToken,
        postLogoutRedirectUri: POST_LOGOUT_URL,
      });
    }

    clearTokenCookies(res);
    res.redirect(302, logoutUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/goodbye', (req, res) => {
  res.type('html').send(
    page(
      'Signed out',
      `<h1>Goodbye</h1>
       <p>You have been signed out successfully.</p>
       <p><a href="/">Return to the public landing page</a></p>`
    )
  );
});

app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).type('html').send(
    page(
      'Server error',
      `<h1>Server error</h1>
       <p>${escapeHtml(err.message || 'Unexpected error')}</p>
       <p><a href="/">Return home</a></p>`
    )
  );
});

app.listen(PORT, () => {
  console.log(`Scalekit SaaSKit HRD demo listening on http://localhost:${PORT}`);
});
