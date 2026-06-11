import os
import socket
import time
from urllib.parse import urlparse, parse_qs

import pytest
import requests
from xprocess import ProcessStarter


PROJECT_DIR = "/home/user/myproject"
BASE_URL = "http://localhost:3000"


def _wait_for_port(host: str, port: int, timeout: float = 60.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((host, port)) == 0:
                return True
        time.sleep(0.5)
    return False


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "saaskit_logout_app"
        args = ["npm", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", 3000)) == 0

    xprocess.ensure(Starter.name, Starter)
    assert _wait_for_port("localhost", 3000, timeout=60), \
        "Express app did not start listening on port 3000."

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()


def _scalekit_env_origin() -> str:
    env_url = os.environ.get("SCALEKIT_ENV_URL", "").strip()
    assert env_url, "SCALEKIT_ENV_URL must be set in the verifier environment."
    parsed = urlparse(env_url)
    assert parsed.scheme and parsed.netloc, \
        f"SCALEKIT_ENV_URL must be a full URL, got: {env_url!r}"
    return f"{parsed.scheme}://{parsed.netloc}"


def test_goodbye_route_returns_plain_text(start_app):
    """The /goodbye route must return HTTP 200 with body 'Goodbye'."""
    resp = requests.get(f"{BASE_URL}/goodbye", timeout=10)
    assert resp.status_code == 200, \
        f"GET /goodbye expected 200, got {resp.status_code}. Body: {resp.text!r}"
    assert resp.text.strip() == "Goodbye", \
        f"GET /goodbye expected body 'Goodbye', got {resp.text!r}"


def test_logout_with_cookies_redirects_to_scalekit(start_app):
    """The /logout route must 302 to Scalekit's /oidc/logout with correct query params and clear cookies."""
    expected_origin = _scalekit_env_origin()
    id_token_value = "fake-id-token-zr-test"
    cookies = {
        "idToken": id_token_value,
        "accessToken": "fake-access-token",
        "refreshToken": "fake-refresh-token",
    }
    resp = requests.get(
        f"{BASE_URL}/logout",
        cookies=cookies,
        allow_redirects=False,
        timeout=10,
    )

    assert resp.status_code == 302, \
        f"GET /logout expected status 302, got {resp.status_code}. Body: {resp.text!r}"

    location = resp.headers.get("Location", "")
    assert location, "GET /logout response is missing a Location header."

    parsed = urlparse(location)
    actual_origin = f"{parsed.scheme}://{parsed.netloc}"
    assert actual_origin == expected_origin, (
        f"Logout redirect origin mismatch. Expected {expected_origin}, "
        f"got {actual_origin}. Full Location: {location}"
    )
    assert parsed.path == "/oidc/logout", (
        f"Logout redirect path must be /oidc/logout, got {parsed.path!r}. "
        f"Full Location: {location}"
    )

    query = parse_qs(parsed.query)
    assert query.get("id_token_hint") == [id_token_value], (
        f"Expected id_token_hint={id_token_value!r} in redirect URL, "
        f"got {query.get('id_token_hint')}. Full Location: {location}"
    )
    assert query.get("post_logout_redirect_uri") == [f"{BASE_URL}/goodbye"], (
        f"Expected post_logout_redirect_uri={BASE_URL}/goodbye in redirect URL, "
        f"got {query.get('post_logout_redirect_uri')}. Full Location: {location}"
    )

    # Set-Cookie headers must clear each of the three session cookies.
    raw_set_cookies = resp.raw.headers.getlist("Set-Cookie") \
        if hasattr(resp.raw.headers, "getlist") else resp.headers.get("Set-Cookie", "").split(",")

    joined_set_cookie = "\n".join(raw_set_cookies)
    for cookie_name in ("accessToken", "refreshToken", "idToken"):
        assert cookie_name in joined_set_cookie, (
            f"Expected a Set-Cookie header that clears {cookie_name!r}. "
            f"Got Set-Cookie headers: {raw_set_cookies}"
        )

    # Each cleared cookie must signal expiry/zero max-age.
    for cookie_name in ("accessToken", "refreshToken", "idToken"):
        matching = [h for h in raw_set_cookies if h.lstrip().startswith(f"{cookie_name}=")]
        assert matching, (
            f"Could not find a Set-Cookie header beginning with '{cookie_name}='. "
            f"Got: {raw_set_cookies}"
        )
        header = matching[0]
        cleared = (
            "Max-Age=0" in header
            or "max-age=0" in header
            or "Expires=Thu, 01 Jan 1970" in header
            or "expires=Thu, 01 Jan 1970" in header
        )
        assert cleared, (
            f"Set-Cookie for {cookie_name!r} does not look cleared. Header: {header!r}"
        )


def test_logout_without_cookies_still_redirects(start_app):
    """If no idToken cookie is present, /logout still redirects to Scalekit's logout endpoint."""
    expected_origin = _scalekit_env_origin()
    resp = requests.get(
        f"{BASE_URL}/logout",
        allow_redirects=False,
        timeout=10,
    )
    assert resp.status_code == 302, \
        f"GET /logout (no cookies) expected status 302, got {resp.status_code}."

    location = resp.headers.get("Location", "")
    assert location, "GET /logout (no cookies) response missing Location header."

    parsed = urlparse(location)
    actual_origin = f"{parsed.scheme}://{parsed.netloc}"
    assert actual_origin == expected_origin, (
        f"Logout redirect origin mismatch. Expected {expected_origin}, "
        f"got {actual_origin}. Full Location: {location}"
    )
    assert parsed.path == "/oidc/logout", (
        f"Logout redirect path must be /oidc/logout, got {parsed.path!r}."
    )
    query = parse_qs(parsed.query)
    assert query.get("post_logout_redirect_uri") == [f"{BASE_URL}/goodbye"], (
        f"Expected post_logout_redirect_uri={BASE_URL}/goodbye, "
        f"got {query.get('post_logout_redirect_uri')}."
    )
