const express = require('express');
const cookieParser = require('cookie-parser');
const { ScalekitClient } = require('@scalekit-sdk/node');

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

// Robust wrapper to support both positional arguments and options object
const originalGetLogoutUrl = scalekit.getLogoutUrl.bind(scalekit);
scalekit.getLogoutUrl = function(options, postLogoutRedirectUri) {
  if (typeof options === 'string') {
    return originalGetLogoutUrl({
      idTokenHint: options,
      postLogoutRedirectUri: postLogoutRedirectUri
    });
  }
  return originalGetLogoutUrl(options);
};

const PORT = 3000;
const CALLBACK_URL = 'http://localhost:3000/callback';

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// 1. GET /
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Scalekit SaaSKit + AgentKit App</title>
      <style>
        body { font-family: sans-serif; margin: 40px; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .btn:hover { background-color: #0056b3; }
      </style>
    </head>
    <body>
      <h1>Welcome to Scalekit SaaSKit + AgentKit App</h1>
      <p>This is a sample application showing how to combine SaaSKit (hosted login) and AgentKit (connected accounts).</p>
      <a href="/login" class="btn" id="signin-btn">Sign in</a>
    </body>
    </html>
  `);
});

// 2. GET /login
app.get('/login', (req, res) => {
  try {
    const authUrl = scalekit.getAuthorizationUrl(CALLBACK_URL, {
      scopes: ['openid', 'profile', 'email', 'offline_access']
    });
    console.log("Redirecting to Scalekit authorization URL:", authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error("Error generating authorization URL:", error);
    res.status(500).send("Error generating authorization URL: " + error.message);
  }
});

// 3. GET /callback
app.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    console.error("SSO callback error:", error, error_description);
    return res.status(400).send(`SSO Callback Error: ${error_description || error}`);
  }
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const result = await scalekit.authenticateWithCode(code, CALLBACK_URL);
    
    // Store tokens in HttpOnly cookies
    res.cookie('accessToken', result.accessToken, { httpOnly: true, secure: false });
    res.cookie('refreshToken', result.refreshToken, { httpOnly: true, secure: false });
    res.cookie('idToken', result.idToken, { httpOnly: true, secure: false });

    console.log("Authentication successful, redirecting to /dashboard");
    res.redirect('/dashboard');
  } catch (err) {
    console.error("Error exchanging code:", err);
    res.status(500).send("Error exchanging code: " + err.message);
  }
});

// 4. GET /dashboard
app.get('/dashboard', async (req, res) => {
  const { idToken } = req.cookies;
  if (!idToken) {
    console.log("No idToken cookie found, redirecting to /login");
    return res.redirect('/login');
  }

  const payload = decodeJwt(idToken);
  if (!payload || !payload.email) {
    console.log("Invalid idToken, redirecting to /login");
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('idToken');
    return res.redirect('/login');
  }

  const email = payload.email;
  let repos = [];
  let fetchError = null;

  try {
    // Fetch GitHub repositories using AgentKit
    const response = await scalekit.tools.executeTool({
      toolName: 'github_user_repos_list',
      identifier: 'zealt-user01',
      connector: 'github-test',
      params: {
        per_page: 10
      }
    });

    if (response && response.data && Array.isArray(response.data.array)) {
      repos = response.data.array;
    } else {
      console.warn("Unexpected executeTool response structure:", response);
    }
  } catch (err) {
    console.error("Error fetching GitHub repositories:", err);
    fetchError = err.message;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        body { font-family: sans-serif; margin: 40px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 20px; }
        .logout-btn { display: inline-block; padding: 8px 15px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; }
        .logout-btn:hover { background-color: #bd2130; }
        .repo-list { list-style-type: none; padding: 0; }
        .repo-item { padding: 10px; border: 1px solid #eee; margin-bottom: 10px; border-radius: 4px; }
        .repo-name { font-weight: bold; }
        .repo-url { color: #555; font-size: 0.9em; }
        .error { color: #dc3545; background-color: #f8d7da; padding: 10px; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Dashboard</h1>
          <p>Signed in as: <strong id="user-email">${email}</strong></p>
        </div>
        <a href="/logout" class="logout-btn" id="logout-btn">Sign out</a>
      </div>

      <h2>Your Connected GitHub Repositories</h2>
      ${fetchError ? `<p class="error">Error loading repositories: ${fetchError}</p>` : ''}
      
      ${repos.length === 0 && !fetchError ? '<p>No repositories found.</p>' : ''}
      
      <ul class="repo-list">
        ${repos.map(repo => `
          <li class="repo-item">
            <div class="repo-name">${repo.full_name}</div>
            <a href="${repo.html_url}" class="repo-url" target="_blank">${repo.html_url}</a>
          </li>
        `).join('')}
      </ul>
    </body>
    </html>
  `);
});

// 5. GET /logout
app.get('/logout', (req, res) => {
  const { idToken } = req.cookies;
  
  let logoutUrl;
  try {
    // Generate the logout URL using the wrapped method (supporting positional arguments)
    logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
  } catch (err) {
    console.error("Error generating logout URL:", err);
    logoutUrl = 'http://localhost:3000/goodbye';
  }

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  console.log("Redirecting to Scalekit logout URL:", logoutUrl);
  res.redirect(logoutUrl);
});

// 6. GET /goodbye
app.get('/goodbye', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logged Out</title>
      <style>
        body { font-family: sans-serif; margin: 40px; text-align: center; }
        .btn { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
        .btn:hover { background-color: #0056b3; }
      </style>
    </head>
    <body>
      <h1>Goodbye!</h1>
      <p id="logout-message">You have been successfully signed out.</p>
      <a href="/" class="btn">Go to Home</a>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
