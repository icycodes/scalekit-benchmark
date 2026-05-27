import importlib
import os
import shutil


PROJECT_DIR = "/home/user/myproject"


def test_python3_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task starts."
    )


def test_project_directory_is_empty():
    # The executor is expected to author /home/user/myproject/run.py and produce
    # /home/user/myproject/output.log themselves. Neither should exist yet.
    assert not os.path.exists(os.path.join(PROJECT_DIR, "run.py")), (
        f"Expected {PROJECT_DIR}/run.py to be absent before the task starts."
    )
    assert not os.path.exists(os.path.join(PROJECT_DIR, "output.log")), (
        f"Expected {PROJECT_DIR}/output.log to be absent before the task starts."
    )


def test_scalekit_sdk_importable():
    try:
        importlib.import_module("scalekit")
    except Exception as exc:
        raise AssertionError(
            "Expected the Scalekit Python SDK (scalekit) to be importable, "
            f"but import failed: {exc}"
        )


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET", "SCALEKIT_ENV_URL"):
        value = os.environ.get(var, "")
        assert value, f"Expected environment variable {var} to be set in the task environment."


def test_zealt_run_id_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "Expected ZEALT_RUN_ID environment variable to be set in the task environment."
