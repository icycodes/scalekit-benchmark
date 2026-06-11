import importlib
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_python3_available():
    assert shutil.which("python3") is not None, (
        "python3 binary not found in PATH."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_scalekit_sdk_importable():
    try:
        importlib.import_module("scalekit")
    except Exception as exc:  # pragma: no cover - explicit failure message
        raise AssertionError(
            f"Scalekit Python SDK is not importable: {exc!r}"
        )


def test_flask_importable():
    try:
        importlib.import_module("flask")
    except Exception as exc:  # pragma: no cover - explicit failure message
        raise AssertionError(
            f"Flask is not importable: {exc!r}"
        )


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_ENV_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(var), (
            f"Required environment variable {var} is not set."
        )
