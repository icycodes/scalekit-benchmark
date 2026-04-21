import os
import subprocess
import time
import socket
import pytest
import requests

PROJECT_DIR = "/home/user/mcp-server"
PORT = 8000

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
        ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(PORT)],
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

def test_metadata_endpoint(start_server):
    url = f"http://localhost:{PORT}/.well-known/oauth-protected-resource"
    response = requests.get(url)
    assert response.status_code == 200
    
    data = response.json()
    assert data["authorization_servers"] == ["https://auth.example.com/resources/res_123"]
    assert data["bearer_methods_supported"] == ["header"]
    assert data["resource"] == "https://mcp.example.com"
    assert "todo:read" in data["scopes_supported"]
    assert "todo:write" in data["scopes_supported"]
