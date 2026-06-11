import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { ScalekitClient } from '@scalekit-sdk/node';

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------
const envUrl = process.env.SCALEKIT_ENV_URL ?? '';
const clientId = process.env.SCALEKIT_CLIENT_ID ?? '';
const clientSecret = process.env.SCALEKIT_CLIENT_SECRET ?? '';

if (!envUrl || !clientId || !clientSecret) {
  console.warn(
    'Warning: one or more Scalekit environment variables are not set ' +
      '(SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET).',
  );
}

// ---------------------------------------------------------------------------
// Scalekit client – initialised once at module scope (singleton)
// ---------------------------------------------------------------------------
const scalekitClient = new ScalekitClient(envUrl, clientId, clientSecret);

// ---------------------------------------------------------------------------
// Express application
// ---------------------------------------------------------------------------
const app = express();

// Parse cookies so that req.cookies.<name> is available in route handlers
app.use(cookieParser());

// ---------------------------------------------------------------------------
// POST-LOGOUT REDIRECT TARGET
// GET /goodbye – responds 200 "Goodbye" after Scalekit redirects the browser
//               back to the application on successful logout.
// ---------------------------------------------------------------------------
app.get('/goodbye', (_req: Request, res: Response): void => {
  res.status(200).type('text/plain').send('Goodbye');
});

// ---------------------------------------------------------------------------
// LOGOUT ROUTE
// GET /logout – ends the application session and hands the browser off to
//               Scalekit's OIDC end-session endpoint.
//
// Flow:
//  1. Read the `idToken` cookie (used as the id_token_hint parameter so that
//     Scalekit can identify which session to terminate server-side).
//  2. Build the Scalekit logout URL *before* clearing cookies, because the
//     helper reads the id_token_hint value synchronously.
//  3. Clear all three session cookies by sending Set-Cookie headers with an
//     expiry date in the past.
//  4. Issue an HTTP 302 redirect to the Scalekit logout URL; the browser will
//     follow the redirect, Scalekit will end its own session, and then
//     redirect the user to /goodbye.
// ---------------------------------------------------------------------------
app.get('/logout', (req: Request, res: Response): void => {
  const POST_LOGOUT_REDIRECT_URI = 'http://localhost:3000/goodbye';

  // Step 1 – retrieve the id token from the incoming cookies
  const idTokenHint: string | undefined = req.cookies['idToken'] as string | undefined;

  // Step 2 – build the Scalekit OIDC logout URL
  //          Must be done before clearing cookies so the token value is still available.
  const logoutUrl: string = scalekitClient.getLogoutUrl({
    idTokenHint,
    postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
  });

  // Step 3 – clear all three session cookies
  //          Passing the same options that were used when setting the cookies
  //          (httpOnly, sameSite) ensures the browser honours the clear instruction.
  const clearOptions: Parameters<typeof res.clearCookie>[1] = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
  res.clearCookie('idToken', clearOptions);

  // Step 4 – redirect the browser to Scalekit's /oidc/logout endpoint (302)
  res.redirect(logoutUrl);
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

export default app;
