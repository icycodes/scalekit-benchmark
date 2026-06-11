import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_sdk_importable():
    # The target library must be installed in the environment so the agent can
    # drive AgentKit without having to install it first.
    import importlib

    spec = importlib.util.find_spec("scalekit")
    assert spec is not None, "Python package 'scalekit' (scalekit-sdk-python) is not installed."


def test_gh_cli_available():
    # GitHub CLI is required to create the target repository and to verify the
    # final state.
    assert shutil.which("gh") is not None, "GitHub CLI ('gh') not found in PATH."


def test_python3_available():
    assert shutil.which("python3") is not None, "python3 not found in PATH."


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET", "SCALEKIT_ENV_URL"):
        assert os.environ.get(var), f"Required environment variable {var} is not set."


def test_github_token_present():
    # The github.md integration rules state GH_TOKEN is exposed for zealt-user01.
    assert os.environ.get("GH_TOKEN"), "Required environment variable GH_TOKEN is not set."


def test_run_id_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "Required environment variable ZEALT_RUN_ID is not set."
