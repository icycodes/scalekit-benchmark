import os
import importlib

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_sdk_importable():
    try:
        module = importlib.import_module("scalekit")
    except Exception as exc:  # pragma: no cover - failure path
        raise AssertionError(
            f"scalekit Python SDK is not importable: {exc!r}."
        )
    assert module is not None, "scalekit module imported as None."


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_ENV_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(var), f"Required environment variable {var} is not set."


def test_no_premade_tools_json():
    tools_path = os.path.join(PROJECT_DIR, "tools.json")
    assert not os.path.exists(tools_path), (
        f"Unexpected pre-existing artifact at {tools_path}; the executor must create it."
    )


def test_no_premade_output_log():
    log_path = os.path.join(PROJECT_DIR, "output.log")
    assert not os.path.exists(log_path), (
        f"Unexpected pre-existing artifact at {log_path}; the executor must create it."
    )
