import os
import shutil


PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    # npx is used to run TypeScript / ts-node style executions without global installs.
    assert shutil.which("npx") is not None, "npx not found in PATH."


def test_gh_cli_available():
    # The agent uses gh to bootstrap the repository, and the verifier uses gh
    # to check the final state.
    assert shutil.which("gh") is not None, "GitHub CLI ('gh') not found in PATH."


def test_scalekit_env_vars_present():
    for name in ("SCALEKIT_ENVIRONMENT_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(name), f"Required Scalekit env var {name} is not set."


def test_github_token_present():
    # The integration provides GH_TOKEN for zealt-user01.
    assert os.environ.get("GH_TOKEN"), "Required environment variable GH_TOKEN is not set."


def test_run_id_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "Required environment variable ZEALT_RUN_ID is not set."
