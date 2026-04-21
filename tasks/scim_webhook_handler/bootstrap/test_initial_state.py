import os
import shutil
import pytest

def test_node_installed():
    assert shutil.which("node") is not None, "Node.js not found in PATH."

def test_env_vars_present():
    assert "SCALEKIT_WEBHOOK_SECRET" in os.environ, "SCALEKIT_WEBHOOK_SECRET not found."
