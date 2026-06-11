# SaaSKit Flask Login Redirect

A minimal Flask application that redirects `/login` to Scalekit's hosted SaaSKit authorization endpoint.

## Setup

Install dependencies:

```sh
python3 -m pip install -r requirements.txt
```

Provide the Scalekit credentials in the environment:

```sh
export SCALEKIT_ENV_URL="https://your-scalekit-environment"
export SCALEKIT_CLIENT_ID="your-client-id"
export SCALEKIT_CLIENT_SECRET="your-client-secret"
```

Run the app:

```sh
python3 app.py
```

The server binds to `0.0.0.0:3000`.

## Endpoints

- `GET /healthz` returns `ok`
- `GET /login` returns a `302` redirect to the Scalekit authorization URL with redirect URI `http://localhost:3000/callback`
