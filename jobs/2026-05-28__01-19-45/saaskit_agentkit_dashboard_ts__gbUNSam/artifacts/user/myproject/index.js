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

app.get('/login', (req, res) => {
  const authUrl = scalekit.getAuthorizationUrl(
    redirectUri,
    {
      scopes: ['openid', 'profile', 'email', 'offline_access']
    }
  );
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No code provided');
  }
  try {
    const tokens = await scalekit.authenticateWithCode(code, redirectUri);
    res.cookie('accessToken', tokens.accessToken, { httpOnly: true });
    res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true });
    res.cookie('idToken', tokens.idToken, { httpOnly: true });
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

app.get('/dashboard', async (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }

  try {
    const payloadBase64 = idToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
    const email = payload.email;

    const toolRes = await scalekit.tools.executeTool({
      toolName: 'github_user_repos_list',
      identifier: 'zealt-user01',
      connector: 'github-test',
      params: {}
    });

    const repos = toolRes.data && toolRes.data.array ? toolRes.data.array : [];

    let reposHtml = '<ul>';
    for (const repo of repos) {
      reposHtml += `<li><a href="${repo.html_url}">${repo.full_name || repo.name}</a></li>`;
    }
    reposHtml += '</ul>';

    res.send(`
      <html>
        <body>
          <h1>Dashboard</h1>
          <p>Signed in as: ${email}</p>
          <h2>GitHub Repositories</h2>
          ${reposHtml}
          <br/>
          <a href="/logout">Sign out</a>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Dashboard error: ' + error.message);
  }
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/goodbye');
  }
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: 'http://localhost:3000/goodbye'
  });
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Signed out</h1>
        <p>You have been successfully logged out. Goodbye!</p>
        <a href="/">Go to Home</a>
      </body>
    </html>
  `);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
