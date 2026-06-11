import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_gh_available():
    assert shutil.which("gh") is not None, "gh (GitHub CLI) binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_env_url_set():
    assert os.environ.get("SCALEKIT_ENV_URL"), "SCALEKIT_ENV_URL is not set in the environment."


def test_scalekit_client_id_set():
    assert os.environ.get("SCALEKIT_CLIENT_ID"), "SCALEKIT_CLIENT_ID is not set in the environment."


def test_scalekit_client_secret_set():
    assert os.environ.get("SCALEKIT_CLIENT_SECRET"), "SCALEKIT_CLIENT_SECRET is not set in the environment."
