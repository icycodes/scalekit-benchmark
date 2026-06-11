import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task starts."
    )


def test_node_is_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_is_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_is_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_tsx_is_available():
    # tsx is the TypeScript runner used to execute the agent code.
    assert shutil.which("tsx") is not None, (
        "tsx binary not found in PATH; the TypeScript runner is required."
    )


def test_gh_cli_is_available():
    # The verifier uses gh CLI to confirm the repository was created.
    assert shutil.which("gh") is not None, "gh (GitHub CLI) binary not found in PATH."


def test_scalekit_node_sdk_is_installed():
    # The Scalekit Node SDK must be preinstalled and importable in /home/user/myproject.
    result = subprocess.run(
        ["node", "-e", "require.resolve('@scalekit-sdk/node')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Expected the @scalekit-sdk/node package to be installed in the project, "
        f"but require.resolve failed: stdout={result.stdout!r} stderr={result.stderr!r}"
    )


def test_scalekit_env_url_is_set():
    assert os.environ.get("SCALEKIT_ENV_URL"), (
        "Environment variable SCALEKIT_ENV_URL is required but not set."
    )


def test_scalekit_client_id_is_set():
    assert os.environ.get("SCALEKIT_CLIENT_ID"), (
        "Environment variable SCALEKIT_CLIENT_ID is required but not set."
    )


def test_scalekit_client_secret_is_set():
    assert os.environ.get("SCALEKIT_CLIENT_SECRET"), (
        "Environment variable SCALEKIT_CLIENT_SECRET is required but not set."
    )


def test_zealt_run_id_is_set():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "Environment variable ZEALT_RUN_ID is required but not set."


def test_gh_token_is_set():
    # gh CLI uses GH_TOKEN for authentication during verification.
    assert os.environ.get("GH_TOKEN") or os.environ.get("GH_TOKEN_01"), (
        "Environment variable GH_TOKEN (or GH_TOKEN_01) is required for GitHub CLI verification."
    )
