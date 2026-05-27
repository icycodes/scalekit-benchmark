import os
import re
import socket
from urllib.parse import urlparse, parse_qs, unquote

import pytest
import requests
from xprocess import ProcessStarter

from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"
BASE_URL = "http://localhost:3000"
TEST_USER_EMAIL = "zealt-user01+sktest@test.com"
TEST_USER_OTP = "424242"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the user's Express.js app via `npm start` and wait until port
    3000 is listening before yielding to the tests."""

    class Starter(ProcessStarter):
        name = "saaskit_express_app"
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
                s.settimeout(1.0)
                return s.connect_ex(("localhost", 3000)) == 0

    xprocess.ensure(Starter.name, Starter)

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()


@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()


# ----------------------------- HTTP-level checks -----------------------------


def test_landing_page_has_sign_in_link(start_app):
    resp = requests.get(f"{BASE_URL}/", allow_redirects=False, timeout=30)
    assert resp.status_code == 200, (
        f"GET / should return 200 with the landing HTML page, got {resp.status_code}."
    )
    body = resp.text or ""
    assert "/login" in body.lower(), (
        "Landing page must contain a link or button whose target is `/login`. "
        f"Got body (truncated): {body[:500]!r}"
    )
    assert re.search(r"sign\s*in|log\s*in|login", body, flags=re.IGNORECASE), (
        "Landing page must display a visible 'Sign in' / 'Log in' control text. "
        f"Got body (truncated): {body[:500]!r}"
    )


def test_login_redirects_to_scalekit_authorize(start_app):
    resp = requests.get(f"{BASE_URL}/login", allow_redirects=False, timeout=30)
    assert resp.status_code in (302, 303, 307), (
        f"GET /login must HTTP-redirect to Scalekit; got status {resp.status_code}."
    )
    location = resp.headers.get("Location", "")
    assert location.startswith("https://"), (
        f"GET /login Location must be an https:// Scalekit URL, got: {location!r}"
    )

    parsed = urlparse(location)
    assert "scalekit" in parsed.netloc.lower(), (
        f"GET /login Location must be a Scalekit-hosted host, got netloc: {parsed.netloc!r}"
    )
    assert "/oauth/authorize" in parsed.path, (
        f"GET /login Location must hit /oauth/authorize, got path: {parsed.path!r}"
    )

    qs = parse_qs(parsed.query)
    assert qs.get("response_type", [""])[0] == "code", (
        f"Authorize URL must include response_type=code, got: {qs.get('response_type')!r}"
    )
    assert qs.get("client_id"), (
        f"Authorize URL must include a client_id parameter, got query: {parsed.query!r}"
    )

    redirect_uri_values = qs.get("redirect_uri", [])
    assert redirect_uri_values, (
        f"Authorize URL must include a redirect_uri parameter, got query: {parsed.query!r}"
    )
    assert redirect_uri_values[0] == "http://localhost:3000/callback", (
        f"redirect_uri must equal http://localhost:3000/callback, "
        f"got: {redirect_uri_values[0]!r}"
    )

    scope_values = qs.get("scope", [])
    assert scope_values, (
        f"Authorize URL must include a scope parameter, got query: {parsed.query!r}"
    )
    scope_str = scope_values[0]
    for required_scope in ("openid", "profile", "email", "offline_access"):
        assert required_scope in scope_str, (
            f"Authorize URL scope must include `{required_scope}`, got scope: {scope_str!r}"
        )


def test_dashboard_redirects_to_login_when_unauthenticated(start_app):
    resp = requests.get(
        f"{BASE_URL}/dashboard", allow_redirects=False, timeout=30
    )
    assert resp.status_code in (302, 303, 307), (
        f"GET /dashboard (no session) must HTTP-redirect to /login, "
        f"got status {resp.status_code}."
    )
    location = resp.headers.get("Location", "")
    assert location.rstrip("/").endswith("/login"), (
        f"GET /dashboard (no session) Location must end with /login, got: {location!r}"
    )


def test_goodbye_page_shows_signed_out_message(start_app):
    resp = requests.get(f"{BASE_URL}/goodbye", allow_redirects=False, timeout=30)
    assert resp.status_code == 200, (
        f"GET /goodbye must return 200, got {resp.status_code}."
    )
    body = (resp.text or "").lower()
    assert re.search(
        r"signed\s*out|logged\s*out|goodbye|good\s*bye|see you", body
    ), (
        "GET /goodbye page must contain a visible sign-out confirmation message "
        "such as 'signed out', 'logged out', or 'goodbye'. "
        f"Got body (truncated): {body[:500]!r}"
    )


def test_logout_redirects_to_scalekit_and_clears_cookies(start_app):
    """Hitting /logout (even with a synthetic id token cookie) must produce
    a redirect to Scalekit's /oidc/logout endpoint with id_token_hint and
    post_logout_redirect_uri parameters, and must clear the session cookies."""
    synthetic_cookies = {
        "idToken": "synthetic-id-token-for-logout-test",
        "accessToken": "synthetic-access-token-for-logout-test",
        "refreshToken": "synthetic-refresh-token-for-logout-test",
    }
    resp = requests.get(
        f"{BASE_URL}/logout",
        allow_redirects=False,
        cookies=synthetic_cookies,
        timeout=30,
    )
    assert resp.status_code in (302, 303, 307), (
        f"GET /logout must HTTP-redirect to the Scalekit logout endpoint, "
        f"got status {resp.status_code}."
    )

    location = resp.headers.get("Location", "")
    assert location.startswith("https://"), (
        f"GET /logout Location must be an https:// Scalekit URL, got: {location!r}"
    )

    parsed = urlparse(location)
    assert "scalekit" in parsed.netloc.lower(), (
        f"GET /logout Location must be on a Scalekit-hosted host, "
        f"got netloc: {parsed.netloc!r}"
    )
    assert "logout" in parsed.path.lower(), (
        f"GET /logout Location must hit a logout endpoint (e.g., /oidc/logout), "
        f"got path: {parsed.path!r}"
    )

    qs = parse_qs(parsed.query)
    id_token_hint = qs.get("id_token_hint", [])
    assert id_token_hint and id_token_hint[0], (
        f"Logout URL must include a non-empty id_token_hint parameter, "
        f"got query: {parsed.query!r}"
    )

    post_logout = qs.get("post_logout_redirect_uri", [])
    assert post_logout, (
        f"Logout URL must include a post_logout_redirect_uri parameter, "
        f"got query: {parsed.query!r}"
    )
    assert unquote(post_logout[0]) == "http://localhost:3000/goodbye", (
        f"post_logout_redirect_uri must decode to http://localhost:3000/goodbye, "
        f"got: {post_logout[0]!r}"
    )

    # Check that all three session cookies are cleared on this response.
    set_cookie_headers = [
        h for h in resp.raw.headers.getlist("Set-Cookie")
    ] if hasattr(resp.raw.headers, "getlist") else resp.headers.get("Set-Cookie", "").split(",")

    # Fall back to a single combined header string if necessary.
    combined = "\n".join(set_cookie_headers) if set_cookie_headers else (
        resp.headers.get("Set-Cookie") or ""
    )
    combined_lower = combined.lower()

    for cookie_name in ("accesstoken", "refreshtoken", "idtoken"):
        cleared = (
            re.search(
                rf"{cookie_name}\s*=\s*;",
                combined_lower,
            )
            or re.search(
                rf"{cookie_name}\s*=[^;]*;\s*[^,]*expires=(?:thu|fri|sat|sun|mon|tue|wed),\s*\d+\s+\w+\s+19\d{{2}}",
                combined_lower,
            )
            or re.search(
                rf"{cookie_name}\s*=[^;]*;\s*[^,]*max-age\s*=\s*0",
                combined_lower,
            )
            or re.search(
                rf"{cookie_name}\s*=[^;]*;\s*[^,]*expires=(?:thu|fri|sat|sun|mon|tue|wed),\s*\d+\s+\w+\s+1970",
                combined_lower,
            )
        )
        assert cleared, (
            f"GET /logout must clear the `{cookie_name}` cookie via Set-Cookie "
            f"(either by setting it to empty, Max-Age=0, or an Expires date in the past). "
            f"Set-Cookie headers were: {combined!r}"
        )


# ----------------------------- Browser-based E2E -----------------------------


def test_end_to_end_signin_with_test_user_otp(start_app, browser_verifier):
    """Drive Scalekit's hosted login flow with the preconfigured test user and
    static OTP, then verify the dashboard shows the signed-in email and the
    sign-out control works."""
    reason = (
        "The Express.js app must integrate Scalekit SaaSKit end-to-end. "
        "Starting from the landing page, a user must be able to sign in through "
        "Scalekit's hosted login using the preconfigured test user and static OTP, "
        "land on a protected dashboard that shows their email, and then sign out "
        "and end up on the goodbye page."
    )
    truth = (
        "Step 1: Navigate to http://localhost:3000/.\n"
        "Step 2: Click the visible 'Sign in' (or 'Log in') link/button on the landing page. "
        "The browser must be redirected to a Scalekit-hosted login page (the URL host should contain 'scalekit').\n"
        "Step 3: On the Scalekit hosted login page, enter the email address "
        f"'{TEST_USER_EMAIL}' into the email field and click Continue / Submit. "
        "If the page asks to choose an authentication method, pick Email OTP / verification code.\n"
        f"Step 4: When the page prompts for a one-time code, enter '{TEST_USER_OTP}' and submit.\n"
        "Step 5: The browser must be redirected back to http://localhost:3000/callback?code=... "
        "and then onward to http://localhost:3000/dashboard.\n"
        f"Step 6: Verify that the /dashboard page visibly contains the email "
        f"'{TEST_USER_EMAIL}' somewhere in its content.\n"
        "Step 7: Verify that a visible 'Sign out' / 'Logout' link or button is present on /dashboard.\n"
        "Step 8: Click the 'Sign out' / 'Logout' control. The browser must end up at "
        "http://localhost:3000/goodbye and the page must show a clearly visible "
        "'signed out' / 'goodbye' / 'logged out' confirmation message."
    )

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_end_to_end_signin_with_test_user_otp",
    )
    assert result.status == "pass", (
        f"Browser verification failed: {getattr(result, 'reason', result)!r}"
    )
