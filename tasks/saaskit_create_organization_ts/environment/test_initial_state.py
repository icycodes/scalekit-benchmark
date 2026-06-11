import json
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_tsx_binary_available():
    assert shutil.which("tsx") is not None, (
        "tsx binary not found in PATH; the task expects a TypeScript runner to be available."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_package_json_exists():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), (
        f"Expected package.json at {pkg_path} so the executor can run a Node script."
    )


def test_scalekit_sdk_installed():
    sdk_dir = os.path.join(PROJECT_DIR, "node_modules", "@scalekit-sdk", "node")
    assert os.path.isdir(sdk_dir), (
        f"Expected @scalekit-sdk/node to be installed at {sdk_dir}."
    )
    sdk_pkg = os.path.join(sdk_dir, "package.json")
    assert os.path.isfile(sdk_pkg), (
        f"Expected @scalekit-sdk/node package.json at {sdk_pkg}."
    )
    with open(sdk_pkg) as f:
        data = json.load(f)
    assert data.get("name") == "@scalekit-sdk/node", (
        f"Unexpected package name in {sdk_pkg}: {data.get('name')!r}."
    )


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET", "SCALEKIT_ENV_URL"):
        assert os.environ.get(var), (
            f"Environment variable {var} must be set before the task runs."
        )


def test_run_id_present():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID environment variable must be set for parallel-safe naming."


def test_output_log_not_yet_created():
    log_path = os.path.join(PROJECT_DIR, "output.log")
    assert not os.path.exists(log_path), (
        f"{log_path} should not exist before the executor runs the task."
    )
