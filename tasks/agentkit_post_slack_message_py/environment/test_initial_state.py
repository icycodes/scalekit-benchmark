import importlib
import os


PROJECT_DIR = "/home/user/scalekit-task"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_scalekit_sdk_importable():
    try:
        importlib.import_module("scalekit")
    except ImportError as exc:
        raise AssertionError(
            "Scalekit Python SDK (scalekit-sdk-python) is not importable. "
            f"Import error: {exc}"
        )


def test_scalekit_env_vars_present():
    for name in (
        "SCALEKIT_ENV_URL",
        "SCALEKIT_CLIENT_ID",
        "SCALEKIT_CLIENT_SECRET",
    ):
        assert os.environ.get(name), (
            f"Environment variable {name} is required but not set."
        )


def test_slack_token_present_for_verification():
    assert os.environ.get("SLACK_TOKEN"), (
        "SLACK_TOKEN must be available so the Slack side effects can be verified."
    )


def test_run_id_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, (
        "ZEALT_RUN_ID must be set so parallel runs can be isolated by run-id."
    )
