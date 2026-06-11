import importlib
import os


PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_sdk_importable():
    try:
        importlib.import_module("scalekit")
    except Exception as exc:  # pragma: no cover - failure path
        raise AssertionError(
            f"scalekit (scalekit-sdk-python) is not importable: {exc!r}"
        )


def test_langchain_core_importable():
    try:
        importlib.import_module("langchain_core")
    except Exception as exc:  # pragma: no cover - failure path
        raise AssertionError(
            f"langchain_core is not importable: {exc!r}"
        )


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET", "SCALEKIT_ENV_URL"):
        assert os.environ.get(var), f"Required environment variable {var} is not set."
