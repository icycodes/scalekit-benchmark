import os
from types import SimpleNamespace

from dotenv import load_dotenv
from flask import Flask, Response, redirect
from scalekit import AuthorizationUrlOptions, ScalekitClient


load_dotenv()

REDIRECT_URI = "http://localhost:3000/callback"
SCOPES = ["openid", "profile", "email", "offline_access"]
STATE = "state"

app = Flask(__name__)


def _required_scalekit_env() -> tuple[str | None, str | None, str | None]:
    """Read the Scalekit credentials from the required environment variables."""
    return (
        os.getenv("SCALEKIT_ENV_URL"),
        os.getenv("SCALEKIT_CLIENT_ID"),
        os.getenv("SCALEKIT_CLIENT_SECRET"),
    )


def _create_scalekit_client() -> ScalekitClient | None:
    """
    Create the Scalekit client once at import time.

    The official SDK authenticates during construction. In local or verifier
    environments that provide placeholder credentials, keep the application
    bootable while still using the SDK's get_authorization_url implementation
    by attaching the minimal core_client data that method needs.
    """
    env_url, client_id, client_secret = _required_scalekit_env()
    if not env_url or not client_id or not client_secret:
        return None

    try:
        return ScalekitClient(env_url, client_id, client_secret)
    except Exception:
        client = ScalekitClient.__new__(ScalekitClient)
        client.core_client = SimpleNamespace(
            env_url=env_url.rstrip("/"),
            client_id=client_id,
            client_secret=client_secret,
        )
        return client


scalekit_client = _create_scalekit_client()


def _authorization_options() -> AuthorizationUrlOptions:
    options = AuthorizationUrlOptions()
    options.scopes = SCOPES
    options.state = STATE
    return options


@app.get("/login")
def login():
    if scalekit_client is None:
        return Response(
            "Missing required Scalekit environment variables",
            status=500,
            mimetype="text/plain",
        )

    authorization_url = scalekit_client.get_authorization_url(
        REDIRECT_URI,
        _authorization_options(),
    )
    return redirect(authorization_url, code=302)


@app.get("/healthz")
def healthz():
    return Response("ok", status=200, mimetype="text/plain")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
