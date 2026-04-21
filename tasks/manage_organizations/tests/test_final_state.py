import os
import subprocess
import pytest
import json

PROJECT_DIR = "/home/user/scalekit-orgs"
ORG_ID_FILE = os.path.join(PROJECT_DIR, "org_id.txt")

def test_org_id_file_exists():
    assert os.path.isfile(ORG_ID_FILE), f"Org ID file {ORG_ID_FILE} does not exist."

def test_verify_org_via_sdk():
    with open(ORG_ID_FILE, "r") as f:
        org_id = f.read().strip()
    
    # Create a small verification script to fetch org details
    verify_script = f"""
const {{ Scalekit }} = require('@scalekit-sdk/node');
const scalekit = new Scalekit(
  process.env.SCALEKIT_ENVIRONMENT_URL,
  process.env.SCALEKIT_CLIENT_ID,
  process.env.SCALEKIT_CLIENT_SECRET
);

async function verify() {{
  try {{
    const org = await scalekit.organization.getOrganization('{org_id}');
    console.log(JSON.stringify(org));
  }} catch (err) {{
    console.error(err);
    process.exit(1);
  }}
}}
verify();
"""
    verify_script_path = os.path.join(PROJECT_DIR, "verify_org.js")
    with open(verify_script_path, "w") as f:
        f.write(verify_script)
    
    result = subprocess.run(["node", "verify_org.js"], capture_output=True, text=True, cwd=PROJECT_DIR)
    assert result.returncode == 0, f"Verification script failed: {result.stderr}"
    
    org_details = json.loads(result.stdout)
    assert org_details['display_name'] == 'Harbor Test Org', f"Expected 'Harbor Test Org', got {org_details['display_name']}"
