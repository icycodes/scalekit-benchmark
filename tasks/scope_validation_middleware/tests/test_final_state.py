import os
import pytest

PROJECT_DIR = "/home/user/scalekit-middleware"

def test_middleware_logic():
    server_path = os.path.join(PROJECT_DIR, "server.js")
    with open(server_path, "r") as f:
        content = f.read()
    assert "validateToken" in content, "validateToken call not found in server.js"
    assert "todo:read" in content, "todo:read scope not found in server.js"
    assert "Authorization" in content or "authorization" in content, "Authorization header check not found"

def test_route_protection():
    server_path = os.path.join(PROJECT_DIR, "server.js")
    with open(server_path, "r") as f:
        content = f.read()
    assert "/todos" in content, "/todos route not found"
    # Basic check that the middleware is applied to the route
    assert "authMiddleware" in content
