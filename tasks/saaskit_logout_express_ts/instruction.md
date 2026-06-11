# Scalekit SaaSKit Logout Endpoint (Express + TypeScript)

## Background

You are extending an Express.js (TypeScript) application that uses Scalekit's SaaSKit (Full-Stack Auth) for user sign-in. After a successful login, the application stores three session tokens (`accessToken`, `refreshToken`, `idToken`) as HttpOnly cookies. Your job is to implement a correctly-behaved server-side logout endpoint that ends both the application session layer and the Scalekit session layer in a single browser redirect.

This logout flow has a few narrow pitfalls (browser redirect vs. API call, ID-token-hint requirement, the cookie-clear ordering) that must be respected. The Scalekit Node SDK exposes a `getLogoutUrl(idTokenHint, postLogoutRedirectUri)` helper which builds the correct URL targeting Scalekit's `/oidc/logout` endpoint.

## Requirements

- Build a small Express + TypeScript app that exposes a `GET /logout` route.
- The route MUST:
  - Read the `idToken` value from the request's cookies (use `cookie-parser`).
  - Use `ScalekitClient.getLogoutUrl(idTokenHint, postLogoutRedirectUri)` to build the Scalekit logout URL. The `postLogoutRedirectUri` MUST be `http://localhost:3000/goodbye` (this URL is preregistered in the dashboard).
  - Clear the three session cookies (`accessToken`, `refreshToken`, `idToken`).
  - Respond with an HTTP 302 redirect whose `Location` header is the Scalekit logout URL.
- The Scalekit client MUST be initialized from the environment variables `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET`.
- Provide a `GET /goodbye` route that responds with HTTP 200 and the plain-text body `Goodbye` so that the post-logout redirect target is reachable for manual smoke testing.

## Implementation Hints

- Install `@scalekit-sdk/node`, `express`, `cookie-parser`, and their `@types/*` dev dependencies.
- Initialize `ScalekitClient` once at module scope: `new ScalekitClient(envUrl, clientId, clientSecret)`.
- Use `cookieParser()` middleware so `req.cookies.idToken` is available.
- The cookie-clear must happen AFTER calling `getLogoutUrl` because the helper needs the ID token value for the `id_token_hint` query parameter.
- For `res.clearCookie`, the response must include `Set-Cookie` headers for each of the three cookie names.
- Use `res.redirect(logoutUrl)` so Express sends a 302 with the correct `Location` header.
- The app must build with TypeScript and start successfully on port 3000.

## Acceptance Criteria

- Project path: /home/user/myproject
- Start command: npm start
- Port: 3000
- Routes:
  - `GET /logout`:
    - When called with cookies `idToken`, `accessToken`, `refreshToken` set, responds with HTTP status `302`.
    - The `Location` response header is a URL pointing at Scalekit's `/oidc/logout` endpoint on the environment hostname taken from `SCALEKIT_ENV_URL`.
    - The `Location` URL query string includes `id_token_hint=<value of idToken cookie>` and `post_logout_redirect_uri=http://localhost:3000/goodbye` (URL-encoded).
    - The response includes `Set-Cookie` headers that clear (expire) each of `accessToken`, `refreshToken`, and `idToken`.
  - `GET /goodbye`:
    - Responds with HTTP status `200` and the body `Goodbye`.

