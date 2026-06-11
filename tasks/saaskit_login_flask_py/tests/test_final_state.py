import os
import socket
from urllib.parse import urlparse, parse_qs

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
APP_PORT = 3000
HEALTH_URL = f"http://localhost:{APP_PORT}/healthz"
LOGIN_URL = f"http://localhost:{APP_PORT}/login"
EXPECTED_REDIRECT_URI = "http://localhost:3000/callback"
REQUIRED_SCOPES = {"openid", "profile", "email", "offline_access"}


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the Flask app using `python3 app.py` and wait for the port to open."""

    class Starter(ProcessStarter):
        name = "saaskit_login_flask_py"
        args = ["python3", "app.py"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", APP_PORT)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()


def test_healthz_endpoint(start_app):
    """Verify the /healthz route returns 200 ok."""
    response = requests.get(HEALTH_URL, timeout=10)
    assert response.status_code == 200, (
        f"Expected /healthz to return 200, got {response.status_code}: {response.text!r}"
    )
    assert response.text.strip() == "ok", (
        f"Expected /healthz response body to be 'ok', got {response.text!r}"
    )


def test_login_returns_302_redirect(start_app):
    """Verify GET /login returns a 302 redirect with a Location header."""
    response = requests.get(LOGIN_URL, allow_redirects=False, timeout=10)
    assert response.status_code == 302, (
        f"Expected /login to return 302, got {response.status_code}: {response.text!r}"
    )
    location = response.headers.get("Location")
    assert location, (
        f"Expected /login response to include a 'Location' header, got headers: {dict(response.headers)}"
    )


def test_login_redirect_target_prefix_and_path(start_app):
    """Verify the Location URL starts with SCALEKIT_ENV_URL and has /oauth/authorize path."""
    env_url = os.environ.get("SCALEKIT_ENV_URL", "").rstrip("/")
    assert env_url, "SCALEKIT_ENV_URL environment variable is not set in the verifier env."

    response = requests.get(LOGIN_URL, allow_redirects=False, timeout=10)
    location = response.headers.get("Location", "")
    assert location.startswith(env_url), (
        f"Expected /login Location to start with SCALEKIT_ENV_URL ({env_url!r}), got: {location!r}"
    )

    parsed = urlparse(location)
    assert parsed.path == "/oauth/authorize", (
        f"Expected Location path to be '/oauth/authorize', got {parsed.path!r} (full URL: {location!r})"
    )


def test_login_redirect_query_parameters(start_app):
    """Verify the Location URL contains the expected OAuth query parameters."""
    expected_client_id = os.environ.get("SCALEKIT_CLIENT_ID", "")
    assert expected_client_id, (
        "SCALEKIT_CLIENT_ID environment variable is not set in the verifier env."
    )

    response = requests.get(LOGIN_URL, allow_redirects=False, timeout=10)
    location = response.headers.get("Location", "")
    parsed = urlparse(location)
    params = parse_qs(parsed.query)

    client_id_values = params.get("client_id", [])
    assert client_id_values == [expected_client_id], (
        f"Expected client_id query param to equal SCALEKIT_CLIENT_ID ({expected_client_id!r}), got {client_id_values!r}"
    )

    redirect_uri_values = params.get("redirect_uri", [])
    assert redirect_uri_values == [EXPECTED_REDIRECT_URI], (
        f"Expected redirect_uri query param to be {EXPECTED_REDIRECT_URI!r}, got {redirect_uri_values!r}"
    )

    response_type_values = params.get("response_type", [])
    assert response_type_values == ["code"], (
        f"Expected response_type query param to be 'code', got {response_type_values!r}"
    )

    scope_values = params.get("scope", [])
    assert len(scope_values) == 1, (
        f"Expected exactly one 'scope' query parameter, got {scope_values!r}"
    )
    scope_tokens = set(scope_values[0].split())
    missing = REQUIRED_SCOPES - scope_tokens
    assert not missing, (
        f"Expected scope to include {sorted(REQUIRED_SCOPES)}, missing: {sorted(missing)} (full scope: {scope_values[0]!r})"
    )
