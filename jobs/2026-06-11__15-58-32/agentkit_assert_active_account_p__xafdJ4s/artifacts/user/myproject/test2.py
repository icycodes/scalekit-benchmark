import os
from scalekit import ScalekitClient

client = ScalekitClient(
    env_url=os.environ.get("SCALEKIT_ENV_URL"),
    client_id=os.environ.get("SCALEKIT_CLIENT_ID"),
    client_secret=os.environ.get("SCALEKIT_CLIENT_SECRET")
)

res = client.actions.get_or_create_connected_account("github-test", "zealt-user01")
ca = res.connected_account
print(ca.id)
print(ca.status)
