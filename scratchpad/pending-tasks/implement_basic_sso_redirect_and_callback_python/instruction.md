Scalekit requires a two-step process for SSO: generating an authorization URL and exchanging an authorization code for tokens upon the user's return.

You need to implement two Flask route handlers (`/login` and `/callback`) using the Scalekit Python SDK. The `/login` route must generate an authorization URL using `scalekit.authentication.get_authorization_url()` and redirect the user. The `/callback` route must extract the `code` parameter from the request and use `scalekit.authentication.authenticate_with_code()` to exchange it for the user profile and tokens. 

**Constraints:**
- You MUST generate a secure, random `state` string, store it in the Flask session, and validate it in the callback route to prevent CSRF attacks.
- Assume the `scalekit` client is already initialized globally and bound to the `scalekit` variable.
- If the `state` parameter does not match the session, the callback must return an HTTP 400 response.