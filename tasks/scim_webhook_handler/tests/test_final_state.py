import os
import subprocess
import time
import socket
import pytest
import requests
import hmac
import hashlib
import json

PROJECT_DIR = "/home/user/scalekit-webhook"
PORT = 3001
SECRET = os.environ.get("SCALEKIT_WEBHOOK_SECRET", "whsec_test_secret")

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

def test_webhook_valid_signature(start_server):
    payload = {"event_type": "user.created", "data": {"id": "usr_123"}}
    body = json.dumps(payload)
    
    # Scalekit signature is usually HMAC-SHA256 of the body
    # Let's assume the SDK expects the signature in a specific format if documented, 
    # otherwise we'll follow standard HMAC.
    # For Scalekit, it's often hex-encoded.
    signature = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "X-Scalekit-Signature": signature
    }
    
    url = f"http://localhost:{PORT}/webhook"
    response = requests.post(url, data=body, headers=headers)
    
    assert response.status_code == 200
    
    log_path = os.path.join(PROJECT_DIR, "events.log")
    with open(log_path, "r") as f:
        content = f.read()
    assert "user.created" in content

def test_webhook_invalid_signature(start_server):
    payload = {"event_type": "user.deleted", "data": {"id": "usr_456"}}
    body = json.dumps(payload)
    headers = {
        "Content-Type": "application/json",
        "X-Scalekit-Signature": "invalid_sig"
    }
    url = f"http://localhost:{PORT}/webhook"
    response = requests.post(url, data=body, headers=headers)
    assert response.status_code == 401
