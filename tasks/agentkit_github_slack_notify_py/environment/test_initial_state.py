import importlib
import os
import shutil


PROJECT_DIR = "/home/user/scalekit-task"


def test_python_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."


def test_scalekit_sdk_importable():
    try:
        importlib.import_module("scalekit")
    except ImportError as exc:  # pragma: no cover - the import failure is the assertion
        raise AssertionError(
            f"scalekit-sdk-python is not importable in the task environment: {exc}"
        )


def test_requests_importable():
    try:
        importlib.import_module("requests")
    except ImportError as exc:  # pragma: no cover - the import failure is the assertion
        raise AssertionError(
            f"requests library is not importable in the task environment: {exc}"
        )


def test_gh_cli_available():
    assert shutil.which("gh") is not None, (
        "GitHub CLI (`gh`) is required for verifying the repository side effect "
        "but was not found in PATH."
    )


def test_curl_available():
    assert shutil.which("curl") is not None, (
        "`curl` is required for verifying the Slack side effects but was not found in PATH."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_scalekit_env_vars_present():
    for env_var in ("SCALEKIT_ENV_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(env_var), (
            f"Required Scalekit environment variable {env_var} is not set."
        )
