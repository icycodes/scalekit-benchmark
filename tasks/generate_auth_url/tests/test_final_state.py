import os
import pytest

PROJECT_DIR = "/home/user/scalekit-auth-url"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")

def test_output_log_exists():
    assert os.path.isfile(LOG_FILE), f"Log file {LOG_FILE} does not exist."

def test_output_log_content():
    with open(LOG_FILE, "r") as f:
        url = f.read().strip()
    
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fcallback" in url, f"Incorrect redirect_uri in URL: {url}"
    assert "organization_id=org_1234567890" in url, f"Incorrect organization_id in URL: {url}"
    assert "state=random_state_string" in url, f"Incorrect state in URL: {url}"
