import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_node_binary_available():
    assert shutil.which("node") is not None, (
        "node binary not found in PATH; Node.js is required to run the Express app."
    )


def test_npm_binary_available():
    assert shutil.which("npm") is not None, (
        "npm binary not found in PATH; npm is required to install dependencies "
        "and to run the project's `npm start` script."
    )


def test_required_env_vars_present():
    for var in ("SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET", "SCALEKIT_ENV_URL"):
        assert os.environ.get(var), (
            f"Required environment variable {var} is not set in the task environment."
        )
