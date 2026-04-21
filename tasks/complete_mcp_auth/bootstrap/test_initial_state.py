import os
import shutil
import pytest

def test_python_installed():
    assert shutil.which("python3") is not None, "Python3 not found in PATH."

def test_instruction_exists():
    assert os.path.isfile("/home/user/mcp-auth/instruction.md"), "instruction.md not found."

def test_env_vars_present():
    assert "SCALEKIT_ENVIRONMENT_URL" in os.environ, "SCALEKIT_ENVIRONMENT_URL not found."
    assert "SCALEKIT_CLIENT_ID" in os.environ, "SCALEKIT_CLIENT_ID not found."
    assert "SCALEKIT_CLIENT_SECRET" in os.environ, "SCALEKIT_CLIENT_SECRET not found."
