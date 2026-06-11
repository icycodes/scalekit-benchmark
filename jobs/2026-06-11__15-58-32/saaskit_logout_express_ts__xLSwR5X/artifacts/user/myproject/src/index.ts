import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const app = express();
const port = 3000;

app.use(cookieParser());

const envUrl = process.env.SCALEKIT_ENV_URL || '';
const clientId = process.env.SCALEKIT_CLIENT_ID || '';
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';

const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

app.get('/logout', (req: Request, res: Response) => {
  const idToken = req.cookies.idToken;
  const postLogoutRedirectUri = 'http://localhost:3000/goodbye';

  const logoutUrl = scalekit.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri
  });

  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  res.redirect(302, logoutUrl);
});

app.get('/goodbye', (req: Request, res: Response) => {
  res.status(200).send('Goodbye');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
