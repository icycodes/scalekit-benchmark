import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

const app = express();
const port = process.env.PORT || 3000;

// Initialize ScalekitClient from environment variables
const envUrl = process.env.SCALEKIT_ENV_URL || '';
const clientId = process.env.SCALEKIT_CLIENT_ID || '';
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET || '';

const scalekitClient = new ScalekitClient(envUrl, clientId, clientSecret);

// Use cookie-parser middleware
app.use(cookieParser());

app.get('/logout', (req: Request, res: Response) => {
  const idToken = req.cookies.idToken;

  // Build the Scalekit logout URL
  const logoutUrl = scalekitClient.getLogoutUrl({
    idTokenHint: idToken,
    postLogoutRedirectUri: 'http://localhost:3000/goodbye',
  });

  // Clear the three session cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.clearCookie('idToken');

  // Redirect to the Scalekit logout URL with HTTP 302
  res.redirect(logoutUrl);
});

app.get('/goodbye', (req: Request, res: Response) => {
  res.status(200).type('text/plain').send('Goodbye');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
