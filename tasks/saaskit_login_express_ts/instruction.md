# Scalekit SaaSKit: Build an Express.js Login / Callback / Logout Web App

## Background
Scalekit SaaSKit (Full-Stack Auth) provides hosted authentication: your app redirects users to Scalekit's hosted login page, and after a successful sign-in Scalekit redirects back to your app's callback URL with an authorization code that you exchange for `idToken`, `accessToken`, and `refreshToken`.

Your task is to implement a small Express.js web application that integrates SaaSKit end-to-end. A real human user (driven by a browser agent during verification) will visit your site, click the sign-in entry point, complete the hosted login using the preconfigured Scalekit test user + static OTP, and land on a protected dashboard that displays their email. They will also be able to sign out and end up on a public goodbye page.

The Scalekit environment has been preconfigured in the dashboard with the following test fixtures (use them verbatim, do **NOT** invent new credentials):

* Allowed callback URL: `http://localhost:3000/callback`
* Initiate-login URL: `http://localhost:3000/login`
* Post-logout URL: `http://localhost:3000/goodbye`
* Test user email: `zealt-user01+sktest@test.com`
* Static OTP (for the test user): `424242`

The Scalekit SDK credentials are provided through the environment variables `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET`.

## Requirements
- Build an Express.js application (Node.js) using the official `@scalekit-sdk/node` SDK. TypeScript or plain JavaScript is acceptable.
- The app **MUST** listen on port `3000` so it matches the registered callback / initiate-login / post-logout URLs above.
- Implement the following routes:
  - `GET /` — a public landing page. It must render an HTML page that contains a visible sign-in entry point (a link or button) that takes the user to `GET /login`.
  - `GET /login` — calls `scalekit.getAuthorizationUrl('http://localhost:3000/callback', { scopes: ['openid', 'profile', 'email', 'offline_access'] })` and HTTP-redirects the user (302/303/307) to that URL.
  - `GET /callback` — receives `?code=<...>`, calls `scalekit.authenticateWithCode(code, 'http://localhost:3000/callback')`, stores `accessToken`, `refreshToken`, and `idToken` in **HttpOnly** cookies, then HTTP-redirects to `/dashboard`.
  - `GET /dashboard` — a protected route. If the user is not authenticated (no valid session cookie), redirect to `/login`. If authenticated, render an HTML page that shows the signed-in user's email address (taken from the decoded `idToken` claims) and a visible "Sign out" link/button that points to `GET /logout`.
  - `GET /logout` — produce the Scalekit logout URL via `scalekit.getLogoutUrl(idToken, 'http://localhost:3000/goodbye')`, then clear the `accessToken`, `refreshToken`, and `idToken` cookies, and HTTP-redirect the browser to the logout URL. After Scalekit invalidates the session it will redirect the browser to `http://localhost:3000/goodbye`.
  - `GET /goodbye` — a public page that confirms the user has signed out (must contain a clearly visible "signed out" / "goodbye" message).

## Implementation Hints
- Install the SDK with `npm install @scalekit-sdk/node express cookie-parser` (add `typescript`/`ts-node`/`tsx` if you want to write TypeScript).
- Initialize the SDK with `new ScalekitClient(process.env.SCALEKIT_ENV_URL!, process.env.SCALEKIT_CLIENT_ID!, process.env.SCALEKIT_CLIENT_SECRET!)`.
- The redirect URI passed to `getAuthorizationUrl` and `authenticateWithCode` **MUST** be `http://localhost:3000/callback` exactly — protocol, host, port, and path must match the dashboard allow-list (do not substitute `127.0.0.1`).
- Logout has to be a browser redirect to `/oidc/logout`, not a `fetch()` POST — the Scalekit session cookie only travels with a real browser navigation.
- Generate the logout URL **before** clearing the `idToken` cookie; the ID token is used as `id_token_hint`.
- Use `cookie-parser` (or equivalent) to read cookies on subsequent requests. You can decode the JWT payload of `idToken` to display the signed-in user's email on `/dashboard`.
- Provide a `package.json` with a `start` script (or equivalent) so the app can be launched with `npm start` from the project directory.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Start command: `npm start`
- Port: `3000`
- Routes (each must respond with the documented behavior):
  - `GET /` → HTML page containing a visible sign-in entry point (link/button) whose target is `/login`.
  - `GET /login` → HTTP 3xx redirect whose `Location` is a Scalekit-hosted authorize URL (`https://...` containing `/oauth/authorize`, `client_id`, the registered `redirect_uri`, and `scope` including `openid`, `profile`, `email`, `offline_access`).
  - `GET /callback?code=<...>` → on success sets `accessToken`, `refreshToken`, and `idToken` as **HttpOnly** cookies and HTTP-redirects to `/dashboard`.
  - `GET /dashboard` (unauthenticated) → HTTP redirect to `/login`.
  - `GET /dashboard` (authenticated) → HTML page that contains the signed-in user's email and a visible "Sign out" link/button targeting `/logout`.
  - `GET /logout` → HTTP 3xx redirect to a Scalekit-hosted URL ending in `/oidc/logout` (or otherwise containing `logout`) with `id_token_hint` and `post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fgoodbye`. The `accessToken`, `refreshToken`, and `idToken` cookies must be cleared on this response.
  - `GET /goodbye` → HTML page containing a clearly visible "signed out" / "goodbye" confirmation message.
- End-to-end browser flow with the preconfigured test user must succeed: starting from `/`, clicking the sign-in entry point and completing Scalekit's hosted login with email `zealt-user01+sktest@test.com` and static OTP `424242` must land the user on `/dashboard` showing that same email.

