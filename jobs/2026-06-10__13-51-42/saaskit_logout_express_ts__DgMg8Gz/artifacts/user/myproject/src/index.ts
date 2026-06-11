import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const port = 3000;
const postLogoutRedirectUri = 'http://localhost:3000/goodbye';

const envUrl = process.env.SCALEKIT_ENV_URL;
const clientId = process.env.SCALEKIT_CLIENT_ID;
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

if (!envUrl || !clientId || !clientSecret) {
  throw new Error(
    'Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET',
  );
}

const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

const app = express();

app.use(cookieParser());

app.get('/logout', (req: Request, res: Response) => {
  const idTokenHint = req.cookies.idToken;

  if (!idTokenHint || typeof idTokenHint !== 'string') {
    res.status(400).send('Missing idToken cookie');
    return;
  }

  // Build the Scalekit logout URL before clearing cookies because the
  // id_token_hint must come from the current application session cookie.
  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint,
    postLogoutRedirectUri,
  });

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  res.redirect(logoutUrl);
});

app.get('/goodbye', (_req: Request, res: Response) => {
  res.type('text/plain').status(200).send('Goodbye');
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
