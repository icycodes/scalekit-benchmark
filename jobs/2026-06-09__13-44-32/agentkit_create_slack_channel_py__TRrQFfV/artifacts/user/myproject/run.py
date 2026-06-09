#!/usr/bin/env python3
"""
Create a Slack channel via Scalekit AgentKit.

Uses the Scalekit Python SDK to create a new public Slack channel named
agentkit-task-{ZEALT_RUN_ID} on behalf of the connected account zealt-user01
through the slack-test connection.
"""

import os
import sys
from scalekit import ScalekitClient
from scalekit.v1.tools.tools_pb2 import ScopedToolFilter
from google.protobuf.json_format import MessageToDict

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
ENV_URL = os.environ["SCALEKIT_ENV_URL"]
CLIENT_ID = os.environ["SCALEKIT_CLIENT_ID"]
CLIENT_SECRET = os.environ["SCALEKIT_CLIENT_SECRET"]
RUN_ID = os.environ["ZEALT_RUN_ID"]

CONNECTION_NAME = "slack-test"
IDENTIFIER = "zealt-user01"
CHANNEL_NAME = f"agentkit-task-{RUN_ID}"

OUTPUT_LOG = "/home/user/myproject/output.log"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def find_channel_create_tool(client):
    """List scoped tools and return the name of the Slack channel-creation tool."""
    tool_filter = ScopedToolFilter()
    tool_filter.connection_names.append(CONNECTION_NAME)

    result_tuple = client.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter=tool_filter,
        page_size=200,
    )
    proto_response = result_tuple[0]

    for scoped_tool in proto_response.tools:
        tool = scoped_tool.tool
        definition_dict = MessageToDict(tool.definition) if tool.definition else {}
        tool_name = definition_dict.get("name", "")

        # Look for a tool whose name contains both "create" and "channel"
        if "create" in tool_name.lower() and "channel" in tool_name.lower():
            # Verify it accepts a "name" parameter for the channel name
            input_schema = definition_dict.get("input_schema", {})
            props = input_schema.get("properties", {})
            if "name" in props:
                return tool_name

    # Not found — print available tools for debugging
    all_names = []
    for st in proto_response.tools:
        d = MessageToDict(st.tool.definition) if st.tool.definition else {}
        all_names.append(d.get("name", "?"))
    print(f"[!] Could not find channel-creation tool. Available: {all_names}")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    # 1. Initialize the Scalekit client
    client = ScalekitClient(
        env_url=ENV_URL,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
    )

    # 2. Discover the channel-creation tool name
    print(f"[*] Discovering Slack channel-creation tool for {IDENTIFIER!r} ...")
    tool_name = find_channel_create_tool(client)
    print(f"[*] Using tool: {tool_name!r}")

    # 3. Execute the tool to create a public channel
    print(f"[*] Creating public channel {CHANNEL_NAME!r} ...")
    exec_result_tuple = client.tools.execute_tool(
        tool_name=tool_name,
        identifier=IDENTIFIER,
        params={"name": CHANNEL_NAME},
        connection_name=CONNECTION_NAME,
    )
    exec_proto = exec_result_tuple[0]

    # The response data is a google.protobuf.Struct containing the channel info
    data_dict = MessageToDict(exec_proto.data) if exec_proto.data else {}
    channel_id = data_dict.get("id", "")
    channel_name = data_dict.get("name", "")

    print(f"[+] Channel created: name={channel_name!r} id={channel_id!r}")

    # 4. Write the summary line to the log file
    log_line = f"Channel: {channel_name} ({channel_id})\n"
    with open(OUTPUT_LOG, "w") as f:
        f.write(log_line)

    print(f"[+] Log written to {OUTPUT_LOG}")


if __name__ == "__main__":
    main()
