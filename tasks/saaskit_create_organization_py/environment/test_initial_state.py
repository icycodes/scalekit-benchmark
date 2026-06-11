import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_scalekit_sdk_importable():
    try:
        importlib.import_module("scalekit")
    except ImportError as e:
        pytest.fail(f"Scalekit Python SDK is not importable: {e}")


def test_scalekit_env_url_set():
    assert os.environ.get("SCALEKIT_ENV_URL"), (
        "SCALEKIT_ENV_URL environment variable is not set."
    )


def test_scalekit_client_id_set():
    assert os.environ.get("SCALEKIT_CLIENT_ID"), (
        "SCALEKIT_CLIENT_ID environment variable is not set."
    )


def test_scalekit_client_secret_set():
    assert os.environ.get("SCALEKIT_CLIENT_SECRET"), (
        "SCALEKIT_CLIENT_SECRET environment variable is not set."
    )


def test_zealt_run_id_set():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID environment variable is not set."


def test_output_log_does_not_exist_yet():
    log_path = os.path.join(PROJECT_DIR, "output.log")
    assert not os.path.exists(log_path), (
        f"Output log {log_path} already exists; expected the executor to create it."
    )
