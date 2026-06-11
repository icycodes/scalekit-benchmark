#!/usr/bin/env python3
"""
Cross-Connector GitHub + Slack Notification via Scalekit AgentKit.

This script:
1. Discovers available tools for the github-test and slack-test connectors.
2. Creates a new public GitHub repository under zealt-user01.
3. Creates a new public Slack channel.
4. Posts a notification message into the Slack channel announcing the new repo.
5. Writes the repo URL, channel ID, and message TS to output.log.
"""

import os
import sys
import json
import logging

from scalekit import ScalekitClient

# ---------------------------------------------------------------------------
# Hard-coded workspace values (do not introduce env vars for these)
# ---------------------------------------------------------------------------
IDENTIFIER = "zealt-user01"
GITHUB_CONNECTION = "github-test"
SLACK_CONNECTION = "slack-test"

# ---------------------------------------------------------------------------
# Runtime configuration
# ---------------------------------------------------------------------------
RUN_ID = os.environ["ZEALT_RUN_ID"]
REPO_NAME = f"harbor-notify-{RUN_ID}"
CHANNEL_NAME = f"harbor-notify-{RUN_ID}"  # lowercase, hyphens, < 80 chars

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


def write_log_line(line: str) -> None:
    """Append a single line to the output log file."""
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main() -> None:
    # Clear the log file at the start of each run
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("")

    # --- Initialize Scalekit client ---
    client = ScalekitClient(
        env_url=os.environ["SCALEKIT_ENV_URL"],
        client_id=os.environ["SCALEKIT_CLIENT_ID"],
        client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
    )

    # --- Step 1: Discover tools for github-test ---
    log.info("Discovering tools for github-test connector...")
    github_tools_resp = client.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter={"connection_names": [GITHUB_CONNECTION]},
        page_size=100,
    )
    # The response is a tuple: (proto_message, metadata)
    github_tools = github_tools_resp[0].tools
    github_tool_names = [t.name for t in github_tools]
    log.info("GitHub tools discovered: %s", github_tool_names)

    # Find the repo-creation tool (e.g. create_repository or create_repo)
    github_create_repo_tool = None
    for t in github_tools:
        if "create" in t.name.lower() and "repo" in t.name.lower():
            github_create_repo_tool = t.name
            break
    if not github_create_repo_tool:
        log.error("Could not find a GitHub repo-creation tool. Available: %s", github_tool_names)
        sys.exit(1)
    log.info("Using GitHub repo-creation tool: %s", github_create_repo_tool)

    # --- Step 2: Discover tools for slack-test ---
    log.info("Discovering tools for slack-test connector...")
    slack_tools_resp = client.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter={"connection_names": [SLACK_CONNECTION]},
        page_size=100,
    )
    slack_tools = slack_tools_resp[0].tools
    slack_tool_names = [t.name for t in slack_tools]
    log.info("Slack tools discovered: %s", slack_tool_names)

    # Find the channel-creation tool
    slack_create_channel_tool = None
    for t in slack_tools:
        if "create" in t.name.lower() and "channel" in t.name.lower():
            slack_create_channel_tool = t.name
            break
    if not slack_create_channel_tool:
        log.error("Could not find a Slack channel-creation tool. Available: %s", slack_tool_names)
        sys.exit(1)
    log.info("Using Slack channel-creation tool: %s", slack_create_channel_tool)

    # Find the message-posting tool
    slack_post_message_tool = None
    for t in slack_tools:
        if ("post" in t.name.lower() or "send" in t.name.lower()) and "message" in t.name.lower():
            slack_post_message_tool = t.name
            break
    if not slack_post_message_tool:
        log.error("Could not find a Slack message-posting tool. Available: %s", slack_tool_names)
        sys.exit(1)
    log.info("Using Slack message-posting tool: %s", slack_post_message_tool)

    # -------------------------------------------------------------------
    # Step 3: Create GitHub repository
    # -------------------------------------------------------------------
    log.info("Creating GitHub repository '%s'...", REPO_NAME)
    github_response = client.actions.execute_tool(
        tool_name=github_create_repo_tool,
        identifier=IDENTIFIER,
        connection_name=GITHUB_CONNECTION,
        tool_input={
            "name": REPO_NAME,
            "private": False,
            "auto_init": True,
        },
    )
    log.info("GitHub response data: %s", json.dumps(github_response.data, indent=2))

    # Extract the repository URL
    repo_html_url = github_response.data.get("html_url")
    if not repo_html_url:
        log.error("GitHub response did not contain 'html_url'. Response data: %s", github_response.data)
        sys.exit(1)
    log.info("Repository URL: %s", repo_html_url)

    # -------------------------------------------------------------------
    # Step 4: Create Slack channel
    # -------------------------------------------------------------------
    log.info("Creating Slack channel '%s'...", CHANNEL_NAME)
    slack_channel_response = client.actions.execute_tool(
        tool_name=slack_create_channel_tool,
        identifier=IDENTIFIER,
        connection_name=SLACK_CONNECTION,
        tool_input={
            "name": CHANNEL_NAME,
            "is_private": False,
        },
    )
    log.info("Slack channel response data: %s", json.dumps(slack_channel_response.data, indent=2))

    # Extract the channel ID — it may be nested under a "channel" key
    channel_data = slack_channel_response.data
    if "channel" in channel_data and isinstance(channel_data["channel"], dict):
        channel_id = channel_data["channel"].get("id")
    else:
        channel_id = channel_data.get("id")
    if not channel_id:
        log.error("Slack channel response did not contain channel ID. Response data: %s", channel_data)
        sys.exit(1)
    log.info("Channel ID: %s", channel_id)

    # -------------------------------------------------------------------
    # Step 5: Post notification message to the Slack channel
    # -------------------------------------------------------------------
    notification_text = (
        f"New repository created: {repo_html_url}"
    )
    log.info("Posting notification to Slack channel '%s'...", channel_id)
    slack_message_response = client.actions.execute_tool(
        tool_name=slack_post_message_tool,
        identifier=IDENTIFIER,
        connection_name=SLACK_CONNECTION,
        tool_input={
            "channel": channel_id,
            "text": notification_text,
        },
    )
    log.info("Slack message response data: %s", json.dumps(slack_message_response.data, indent=2))

    # Extract the message timestamp (ts)
    message_ts = slack_message_response.data.get("ts")
    if not message_ts:
        log.error("Slack message response did not contain 'ts'. Response data: %s", slack_message_response.data)
        sys.exit(1)
    log.info("Message TS: %s", message_ts)

    # -------------------------------------------------------------------
    # Step 6: Write results to output.log
    # -------------------------------------------------------------------
    write_log_line(f"Repository URL: {repo_html_url}")
    write_log_line(f"Channel ID: {channel_id}")
    write_log_line(f"Message TS: {message_ts}")

    log.info("All done! Results written to %s", LOG_FILE)


if __name__ == "__main__":
    main()
