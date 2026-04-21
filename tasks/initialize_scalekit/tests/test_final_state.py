import os
import pytest

PROJECT_DIR = "/home/user/scalekit-init"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")

def test_output_log_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."

def test_output_log_content():
    expected_url = os.environ.get("SCALEKIT_ENVIRONMENT_URL")
    with open(LOG_FILE, "r") as f:
        content = f.read().strip()
    assert content == expected_url, f"Expected {expected_url}, got {content}"
