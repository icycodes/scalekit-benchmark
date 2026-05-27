import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_ENV_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(var), f"Required environment variable {var} is not set."
