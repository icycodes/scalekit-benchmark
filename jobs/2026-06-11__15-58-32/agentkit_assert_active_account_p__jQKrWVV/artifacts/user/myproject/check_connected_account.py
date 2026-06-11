"""
Pre-flight check: verify that the (github-test, zealt-user01) connected account
is ACTIVE in Scalekit before allowing an agent to proceed with tool calls.
"""

import os
import sys

from scalekit import ScalekitClient

# ── Constants (fixture names – do NOT read from env) ──────────────────────────
CONNECTION_NAME = "github-test"
IDENTIFIER = "zealt-user01"
LOG_FILE = "/home/user/myproject/output.log"

# ── Initialise client ─────────────────────────────────────────────────────────
env_url = os.environ["SCALEKIT_ENV_URL"]
client_id = os.environ["SCALEKIT_CLIENT_ID"]
client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]

client = ScalekitClient(
    env_url=env_url,
    client_id=client_id,
    client_secret=client_secret,
)

# ── Fetch the connected account (idempotent – will not mutate an existing one) ─
response = client.actions.get_or_create_connected_account(
    connection_name=CONNECTION_NAME,
    identifier=IDENTIFIER,
)

connected_account = response.connected_account
if connected_account is None:
    print("ERROR: No connected_account returned by the SDK.", file=sys.stderr)
    sys.exit(1)

account_id = connected_account.id or ""
status = connected_account.status or ""

# ── Write log artifact ────────────────────────────────────────────────────────
with open(LOG_FILE, "w", encoding="utf-8") as fh:
    fh.write(f"Connection: {CONNECTION_NAME}\n")
    fh.write(f"Identifier: {IDENTIFIER}\n")
    fh.write(f"Status: {status}\n")
    fh.write(f"Connected Account ID: {account_id}\n")

print(f"Connection: {CONNECTION_NAME}")
print(f"Identifier: {IDENTIFIER}")
print(f"Status: {status}")
print(f"Connected Account ID: {account_id}")

# ── Gate: fail loudly if not ACTIVE ──────────────────────────────────────────
if status != "ACTIVE":
    print(
        f"ERROR: Expected status ACTIVE but got '{status}'. "
        "The connected account is not ready for tool calls.",
        file=sys.stderr,
    )
    sys.exit(1)

print("Pre-flight check passed – connected account is ACTIVE.")
sys.exit(0)
