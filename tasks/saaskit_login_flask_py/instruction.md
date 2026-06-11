# SaaSKit Login Redirect with Flask (Python)

## Background

Scalekit's **SaaSKit (Full-Stack Auth)** ships hosted login pages that an application kicks off by redirecting the browser to Scalekit's `/oauth/authorize` endpoint with the correct OAuth parameters (`client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, ...). The Scalekit Python SDK exposes `ScalekitClient.get_authorization_url(...)` to build this URL deterministically from the SDK's configured credentials and environment URL.

Build a small **Flask** application that exposes a `/login` route which uses the SaaSKit Python SDK to build the authorization URL and redirects the browser to it. The app must read the Scalekit credentials from environment variables and hard-code the registered callback URL `http://localhost:3000/callback`.

## Requirements

- Implement a Flask app served on port `3000`.
- Expose a `GET /login` route that:
  - Builds an authorization URL using the SaaSKit Python SDK with the redirect URI `http://localhost:3000/callback`.
  - Requests the OAuth scopes `openid`, `profile`, `email`, and `offline_access`.
  - Returns an HTTP `302` redirect whose `Location` header points to the SaaSKit-generated authorization URL.
- Expose a `GET /healthz` route that returns plain text `ok` with status `200` so the verifier can confirm the server is up.
- Initialize the `ScalekitClient` from `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET` environment variables.
- Do not invent any new environment variable names; use only those supplied in the environment.

## Implementation Hints

- Install `scalekit-sdk-python` together with `flask` and `python-dotenv`.
- Initialize the SDK once at module import time using the environment variables provided by Scalekit.
- The `get_authorization_url` method of the Python SDK accepts the registered redirect URI and an options object (or dict) where you can pass `scopes`.
- Use `flask.redirect(url, code=302)` to emit the redirect from `/login`.
- Bind the Flask app to `0.0.0.0:3000` so the verifier on the host can reach it.

## Acceptance Criteria

- Project path: /home/user/myproject
- Start command: `python3 app.py`
- Port: 3000
- API Endpoints:
  - `GET /login`
    - Returns HTTP status `302`.
    - The response `Location` header is a fully qualified URL that:
      - Starts with the value of the `SCALEKIT_ENV_URL` environment variable.
      - Has the path `/oauth/authorize` (Scalekit's hosted authorization endpoint).
      - Contains query parameters `client_id` equal to `SCALEKIT_CLIENT_ID`, `redirect_uri` equal to `http://localhost:3000/callback`, `response_type=code`, and a `scope` parameter that includes each of `openid`, `profile`, `email`, and `offline_access` (order-independent, space-separated).
  - `GET /healthz`
    - Returns HTTP status `200` with body `ok`.

