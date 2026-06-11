import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_python_binary_available():
    # Verifier uses the Scalekit Python SDK to inspect the post-run state.
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_scalekit_node_sdk_installed():
    # The Scalekit Node.js SDK should be pre-installed in the project so the
    # executor can require/import it without a network install at run time.
    result = subprocess.run(
        ["node", "-e", "require('@scalekit-sdk/node')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "@scalekit-sdk/node is not installed in the project. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )


def test_scalekit_python_sdk_installed():
    # The verifier relies on the Python SDK to confirm the delete took effect.
    result = subprocess.run(
        ["python3", "-c", "import scalekit"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "scalekit Python SDK is not importable in the verifier environment. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )


def test_scalekit_env_vars_present():
    for name in ("SCALEKIT_ENV_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(name), f"Required environment variable {name} is not set."


def test_zealt_run_id_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "Required environment variable ZEALT_RUN_ID is not set."
