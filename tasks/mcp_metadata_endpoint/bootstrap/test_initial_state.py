import os
import shutil
import pytest

def test_python_installed():
    assert shutil.which("python3") is not None, "Python3 not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir("/home/user"), "Home directory not found."
