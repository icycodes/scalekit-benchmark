import os
import subprocess
import time
import socket
import pytest
import requests

PROJECT_DIR = "/home/user/scalekit-app"
PORT = 3001

def wait_for_port(port, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(('localhost', port)) == 0:
                return True
        time.sleep(1)
    return False

@pytest.fixture(scope="module")
def start_server():
    process = subprocess.Popen(
        ["node", "server.js"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    
    if not wait_for_port(PORT):
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("Express server failed to start.")
    
    yield
    
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=10)

def test_login_redirect(start_server):
    url = f"http://localhost:{PORT}/login?organization_id=org_test"
    response = requests.get(url, allow_redirects=False)
    
    assert response.status_code == 302
    location = response.headers.get("Location", "")
    expected_env_url = os.environ.get("SCALEKIT_ENVIRONMENT_URL")
    
    assert location.startswith(expected_env_url)
    assert "organization_id=org_test" in location
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fcallback" in location
    assert "state=" in location
    assert "set-cookie" in response.headers.get("Set-Cookie", "").lower() or "connect.sid" in response.headers.get("Set-Cookie", "")
