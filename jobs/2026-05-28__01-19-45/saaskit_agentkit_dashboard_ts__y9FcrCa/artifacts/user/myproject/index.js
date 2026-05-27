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

const REDIRECT_URI = 'http://localhost:3000/callback';

// Helper to decode JWT payload
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

app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to Scalekit Demo</h1>
    <a href="/login"><button>Sign in</button></a>
  `);
});

app.get('/login', (req, res) => {
  const url = scalekit.getAuthorizationUrl(REDIRECT_URI, {
    scope: ['openid', 'profile', 'email', 'offline_access'],
  });
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const { accessToken, refreshToken, idToken } = await scalekit.authenticateWithCode(code, REDIRECT_URI);
    
    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });
    res.cookie('idToken', idToken, { httpOnly: true });
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Authentication failed', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', async (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }

  const payload = decodeJwt(idToken);
  if (!payload || !payload.email) {
    return res.redirect('/login');
  }

  try {
    // AgentKit call
    // Connection: github-test, Identifier: zealt-user01
    
    const tools = await scalekit.agentkit.listScopedTools('github-test', 'zealt-user01', { pageSize: 100 });
    const listReposTool = tools.tools.find(t => t.name.includes('list_repositories_for_the_authenticated_user') || (t.description && t.description.toLowerCase().includes('list repositories')));
    
    let repos = [];
    if (listReposTool) {
      const result = await scalekit.agentkit.executeTool('github-test', 'zealt-user01', listReposTool.name, {});
      repos = result.data || [];
    } else {
      console.error('Could not find list repositories tool');
    }

    const repoListHtml = repos.length > 0 
      ? `<ul>${repos.map(repo => `<li>${repo.full_name || repo.html_url}</li>`).join('')}</ul>`
      : '<p>No repositories found.</p>';

    res.send(`
      <h1>Dashboard</h1>
      <p>Signed in as: <strong>${payload.email}</strong></p>
      <h2>Your GitHub Repositories</h2>
      ${repoListHtml}
      <hr>
      <a href="/logout"><button>Sign out</button></a>
    `);
  } catch (error) {
    console.error('Failed to fetch repos', error);
    res.status(500).send('Failed to fetch repositories');
  }
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/goodbye');
  }

  const logoutUrl = scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye');
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <h1>Goodbye!</h1>
    <p>You have been signed out. Thank you for visiting.</p>
    <a href="/">Back to Home</a>
  `);
});

app.listen(port, () => {
  console.log('App listening at http://localhost:' + port);
});
