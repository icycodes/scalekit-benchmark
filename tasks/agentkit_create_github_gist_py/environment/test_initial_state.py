import importlib.util
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_sdk_importable():
    spec = importlib.util.find_spec("scalekit")
    assert spec is not None, "Python package 'scalekit' is not importable in the environment."


def test_python3_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."


def test_gh_cli_available():
    assert shutil.which("gh") is not None, "GitHub CLI 'gh' binary not found in PATH (needed for verification)."
