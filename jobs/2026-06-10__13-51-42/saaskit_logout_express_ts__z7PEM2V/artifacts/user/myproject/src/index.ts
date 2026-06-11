import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const envUrl: string = process.env.SCALEKIT_ENV_URL || '';
const clientId: string = process.env.SCALEKIT_CLIENT_ID || '';
const clientSecret: string = process.env.SCALEKIT_CLIENT_SECRET || '';

const scalekitClient = new ScalekitClient(envUrl, clientId, clientSecret);

const app = express();

app.use(cookieParser());

app.get('/logout', (req: Request, res: Response) => {
  const idToken: string | undefined = req.cookies.idToken;

  const logoutUrl: string = scalekitClient.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: 'http://localhost:3000/goodbye',
  });

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  res.redirect(logoutUrl);
});

app.get('/goodbye', (_req: Request, res: Response) => {
  res.status(200).type('text/plain').send('Goodbye');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
