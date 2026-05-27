"""
Create a Slack channel via Scalekit AgentKit.

Reads credentials from environment variables:
  SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET
  ZEALT_RUN_ID  — used to build the channel name
"""

import os

from scalekit.client import ScalekitClient

# ── Scalekit credentials ───────────────────────────────────────────────────────
ENV_URL       = os.environ["SCALEKIT_ENV_URL"]
CLIENT_ID     = os.environ["SCALEKIT_CLIENT_ID"]
CLIENT_SECRET = os.environ["SCALEKIT_CLIENT_SECRET"]

# ── Task-specific constants ────────────────────────────────────────────────────
CONNECTION_NAME  = "slack-test"
IDENTIFIER       = "zealt-user01"
RUN_ID           = os.environ["ZEALT_RUN_ID"]
CHANNEL_NAME     = f"agentkit-task-{RUN_ID}"
TOOL_NAME        = "slack_create_channel"
LOG_FILE         = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")

# ── Initialize client ──────────────────────────────────────────────────────────
client = ScalekitClient(ENV_URL, CLIENT_ID, CLIENT_SECRET)


def create_slack_channel() -> tuple[str, str]:
    """
    Execute the channel-creation tool and return (channel_name, channel_id).
    """
    print(f"Executing tool '{TOOL_NAME}' with channel name '{CHANNEL_NAME}' ...")

    response = client.actions.execute_tool(
        tool_input={"name": CHANNEL_NAME, "is_private": False},
        tool_name=TOOL_NAME,
        identifier=IDENTIFIER,
        connection_name=CONNECTION_NAME,
    )

    data = response.data
    print(f"Raw response data: {data}")

    # The response data is a dict-like object; the Slack API wraps the result
    # in a 'channel' key, but some adapters hoist the fields to the top level.
    if isinstance(data, dict):
        channel_id   = data.get("id") or (data.get("channel") or {}).get("id")
        channel_name = data.get("name") or (data.get("channel") or {}).get("name")
    else:
        # Fallback: try attribute access
        channel_id   = getattr(data, "id", None)
        channel_name = getattr(data, "name", None)

    if not channel_id or not channel_name:
        raise RuntimeError(f"Unexpected response structure — could not extract id/name: {data}")

    return channel_name, channel_id


def main():
    print(f"Creating Slack channel '{CHANNEL_NAME}' via connection '{CONNECTION_NAME}' for '{IDENTIFIER}' ...")

    channel_name, channel_id = create_slack_channel()

    log_line = f"Channel: {channel_name} ({channel_id})"
    print(log_line)

    with open(LOG_FILE, "w") as fh:
        fh.write(log_line + "\n")

    print(f"Log written to {LOG_FILE}")


if __name__ == "__main__":
    main()
