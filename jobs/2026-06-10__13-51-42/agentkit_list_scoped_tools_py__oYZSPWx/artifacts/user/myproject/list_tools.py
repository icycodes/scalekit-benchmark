#!/usr/bin/env python3
"""List scoped tools for a connected account via Scalekit AgentKit."""

import json
import os

from scalekit import ScalekitClient
from scalekit.tools import ScopedToolFilter


def main():
    # Initialize the Scalekit client from environment variables
    client = ScalekitClient(
        env_url=os.environ["SCALEKIT_ENV_URL"],
        client_id=os.environ["SCALEKIT_CLIENT_ID"],
        client_secret=os.environ["SCALEKIT_CLIENT_SECRET"],
    )

    # Build the filter for the github-test connection
    filter_obj = ScopedToolFilter()
    filter_obj.connection_names.append("github-test")

    # List scoped tools for the given identifier + connection filter
    # page_size=100 ensures all GitHub tools are returned (default page size
    # would hide tools for large connectors like GitHub)
    response, _ = client.tools.list_scoped_tools(
        identifier="zealt-user01",
        filter=filter_obj,
        page_size=100,
    )

    # Extract tool names from the response
    # Each scoped_tool has a 'tool' field, which has a 'definition' field
    # (google.protobuf.Struct). The definition's 'fields' map contains 'name'.
    tool_names = []
    for scoped_tool in response.tools:
        definition = scoped_tool.tool.definition
        # google.protobuf.Struct stores key-value pairs in 'fields'
        tool_name = definition.fields["name"].string_value
        tool_names.append(tool_name)

    # Write tool names as JSON array
    tools_path = "/home/user/myproject/tools.json"
    with open(tools_path, "w") as f:
        json.dump(tool_names, f, indent=2)

    # Write confirmation log
    log_path = "/home/user/myproject/output.log"
    with open(log_path, "w") as f:
        f.write(f"Tools discovered: {len(tool_names)}\n")

    print(f"Done. {len(tool_names)} tools written to {tools_path}")


if __name__ == "__main__":
    main()
