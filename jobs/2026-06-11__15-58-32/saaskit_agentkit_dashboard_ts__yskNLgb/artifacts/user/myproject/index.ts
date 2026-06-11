import express from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const app = express();
app.use(cookieParser());

const scalekit = new ScalekitClient(
  process.env.SCALEKIT_ENV_URL!,
  process.env.SCALEKIT_CLIENT_ID!,
  process.env.SCALEKIT_CLIENT_SECRET!
);

const redirectUri = 'http://localhost:3000/callback';

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Welcome to AgentKit App</h1>
        <a href="/login">Sign in</a>
      </body>
    </html>
  `);
});

app.get('/login', (req, res) => {
  const url = scalekit.getAuthorizationUrl(redirectUri, {
    scopes: ['openid', 'profile', 'email', 'offline_access']
  });
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const tokens = await scalekit.authenticateWithCode(code, redirectUri);
    // Assuming tokens contains accessToken, refreshToken, idToken
    // If it's nested like tokens.token.accessToken, we'll adjust. Let's log it.
    console.log('Tokens:', Object.keys(tokens));
    
    // Set cookies
    res.cookie('accessToken', tokens.accessToken || '', { httpOnly: true });
    res.cookie('refreshToken', tokens.refreshToken || '', { httpOnly: true });
    res.cookie('idToken', tokens.idToken || '', { httpOnly: true });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error in callback:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/dashboard', async (req, res) => {
  const idToken = req.cookies.idToken;
  if (!idToken) {
    return res.redirect('/login');
  }

  try {
    // Decode ID token to get email
    const payloadBase64 = idToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    const email = payload.email;

    // Fetch GitHub repos
    const toolResponse = await scalekit.tools.executeTool({
      toolName: 'github_user_repos_list',
      identifier: 'zealt-user01',
      connector: 'github-test',
      params: {
        per_page: 5
      }
    });

    // Extract repos from toolResponse
    let repos: any[] = [];
    const data = (toolResponse as any).data;
    if (data && Array.isArray(data.array)) {
      repos = data.array;
    } else {
      console.log('Tool response:', Object.keys(toolResponse));
    }

    const reposHtml = Array.isArray(repos) 
      ? repos.map(repo => `<li><a href="${repo.html_url}">${repo.full_name}</a></li>`).join('')
      : `<pre>${JSON.stringify(repos, null, 2)}</pre>`;

    res.send(`
      <html>
        <body>
          <h1>Dashboard</h1>
          <p>Signed in as: ${email}</p>
          <h2>Your GitHub Repositories</h2>
          <ul>
            ${reposHtml}
          </ul>
          <a href="/logout">Sign out</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in dashboard:', error);
    res.status(500).send('Failed to load dashboard');
  }
});

app.get('/logout', (req, res) => {
  const idToken = req.cookies.idToken;
  let logoutUrl = '/goodbye';
  if (idToken) {
    logoutUrl = scalekit.getLogoutUrl({
      idTokenHint: idToken,
      postLogoutRedirectUri: 'http://localhost:3000/goodbye'
    });
  }
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');
  
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>You have successfully signed out. Goodbye!</h1>
        <a href="/">Go to home</a>
      </body>
    </html>
  `);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
