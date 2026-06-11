import os
import shutil


PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_scalekit_env_url_present():
    assert os.environ.get("SCALEKIT_ENV_URL"), \
        "SCALEKIT_ENV_URL environment variable must be provided."


def test_scalekit_client_id_present():
    assert os.environ.get("SCALEKIT_CLIENT_ID"), \
        "SCALEKIT_CLIENT_ID environment variable must be provided."


def test_scalekit_client_secret_present():
    assert os.environ.get("SCALEKIT_CLIENT_SECRET"), \
        "SCALEKIT_CLIENT_SECRET environment variable must be provided."
