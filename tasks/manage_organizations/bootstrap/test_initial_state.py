import os
import shutil
import pytest

def test_node_installed():
    assert shutil.which("node") is not None, "Node.js not found in PATH."

def test_trial_id_exists():
    assert os.path.isfile("/logs/trial_id"), "trial_id file not found at /logs/trial_id."

def test_env_vars_present():
    assert "SCALEKIT_ENVIRONMENT_URL" in os.environ, "SCALEKIT_ENVIRONMENT_URL not found."
    assert "SCALEKIT_CLIENT_ID" in os.environ, "SCALEKIT_CLIENT_ID not found."
    assert "SCALEKIT_CLIENT_SECRET" in os.environ, "SCALEKIT_CLIENT_SECRET not found."
