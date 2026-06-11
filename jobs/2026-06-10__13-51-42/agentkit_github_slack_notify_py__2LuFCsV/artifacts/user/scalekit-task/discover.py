import os
from scalekit import ScalekitClient

env_url = os.environ.get("SCALEKIT_ENV_URL")
client_id = os.environ.get("SCALEKIT_CLIENT_ID")
client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")

client = ScalekitClient(
    env_url=env_url,
    client_id=client_id,
    client_secret=client_secret
)

run_id = os.environ.get("ZEALT_RUN_ID", "test-run")
repo_name = f"harbor-notify-{run_id}"

print(f"Deleting repo '{repo_name}' via proxy request...")
try:
    res = client.actions.request(
        connection_name="github-test",
        identifier="zealt-user01",
        path=f"/repos/zealt-user01/{repo_name}",
        method="DELETE"
    )
    print("Status code:", res.status_code)
except Exception as e:
    print("Error:", e)
