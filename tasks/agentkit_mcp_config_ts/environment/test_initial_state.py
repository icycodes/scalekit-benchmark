import json
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), (
        f"package.json {package_json} does not exist."
    )


def test_package_json_has_start_script():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    scripts = data.get("scripts", {})
    assert "start" in scripts, (
        "package.json must define a 'start' script that runs the program."
    )


def test_scalekit_node_sdk_installed():
    sdk_dir = os.path.join(PROJECT_DIR, "node_modules", "@scalekit-sdk", "node")
    assert os.path.isdir(sdk_dir), (
        f"@scalekit-sdk/node is not installed in {sdk_dir}."
    )


def test_scalekit_env_vars_present():
    for var in ("SCALEKIT_ENV_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"):
        assert os.environ.get(var), (
            f"Environment variable {var} must be set in the task environment."
        )


def test_zealt_run_id_present():
    assert os.environ.get("ZEALT_RUN_ID"), (
        "Environment variable ZEALT_RUN_ID must be set in the task environment."
    )
