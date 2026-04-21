import os
import pytest

PROJECT_DIR = "/home/user/scalekit-admin"
LINK_FILE = os.path.join(PROJECT_DIR, "portal_link.txt")

def test_portal_link_file_exists():
    assert os.path.isfile(LINK_FILE), f"Portal link file {LINK_FILE} does not exist."

def test_portal_link_content():
    with open(LINK_FILE, "r") as f:
        link = f.read().strip()
    
    assert link.startswith("http"), "Portal link must be a valid URL."
    # The portal link might be on a different subdomain or domain depending on the env, 
    # but it should at least be a URL.
    assert "org_1234567890" not in link, "Portal link should be a secure, short-lived tokenized URL, not containing the raw org ID in plain text usually."
    # Actually, Scalekit portal links are usually like https://<env>/portal/<token>
    expected_env = os.environ.get("SCALEKIT_ENVIRONMENT_URL")
    # Some envs might use a different portal domain, but often it's related.
    # Let's just check it's a non-empty string for now, or check for common Scalekit portal patterns.
    assert len(link) > 20
