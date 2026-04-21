import os
import subprocess
import time
import socket
import pytest
import requests

PROJECT_DIR = "/home/user/mcp-auth"
PORT = 8080

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
        ["python3", "main.py"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    
    if not wait_for_port(PORT):
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("FastAPI server failed to start.")
    
    yield
    
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=10)

def test_discovery_endpoint(start_server):
    url = f"http://localhost:{PORT}/.well-known/oauth-protected-resource"
    response = requests.get(url)
    assert response.status_code == 200
    data = response.json()
    assert "authorization_servers" in data
    assert data["resource"] == "https://mcp.example.com"

def test_tools_execute_no_token(start_server):
    url = f"http://localhost:{PORT}/tools/execute"
    response = requests.post(url)
    assert response.status_code == 401

def test_logic_verification():
    # Verify the code contains the scope check
    main_path = os.path.join(PROJECT_DIR, "main.py")
    with open(main_path, "r") as f:
        content = f.read()
    assert "todo:write" in content
    assert "validate_token" in content or "validate_access_token" in content
