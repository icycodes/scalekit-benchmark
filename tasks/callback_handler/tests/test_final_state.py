import os
import pytest

PROJECT_DIR = "/home/user/scalekit-callback"

def test_callback_route_implemented():
    server_path = os.path.join(PROJECT_DIR, "server.js")
    with open(server_path, "r") as f:
        content = f.read()
    assert "/callback" in content, "Callback route not found in server.js"
    assert "authenticateWithCode" in content, "authenticateWithCode call not found in server.js"
    assert "jwt.decode" in content or "jsonwebtoken" in content, "JWT decoding not found in server.js"

def test_package_json_dependencies():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path, "r") as f:
        content = f.read()
    assert "@scalekit-sdk/node" in content
    assert "jsonwebtoken" in content
    assert "express" in content
