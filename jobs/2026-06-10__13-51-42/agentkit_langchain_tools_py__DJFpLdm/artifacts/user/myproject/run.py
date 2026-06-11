"""
Enumerate Scalekit tools through the LangChain adapter.

Uses scalekit_client.actions.langchain.get_tools(...) to discover every
GitHub tool that zealt-user01 is authorized to call through the
github-test connection, then persists a deterministic catalog.
"""

import json
import os
import sys
from scalekit import ScalekitClient


def main():
    env_url = os.environ["SCALEKIT_ENV_URL"]
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]

    identifier = "zealt-user01"
    connection_name = "github-test"

    # Initialize the SDK
    scalekit_client = ScalekitClient(env_url, client_id, client_secret)

    # Reach the LangChain adapter — this returns native LangChain tools
    tools = scalekit_client.actions.langchain.get_tools(
        identifier=identifier,
        connection_names=[connection_name],
        page_size=100,  # large enough to cover every GitHub tool in one page
    )

    # Build the catalog from LangChain BaseTool attributes
    tool_entries = []
    for tool in tools:
        tool_entries.append({
            "name": tool.name,
            "description": tool.description,
        })

    # Sort deterministically by name
    tool_entries.sort(key=lambda t: t["name"])

    catalog = {
        "connection": connection_name,
        "identifier": identifier,
        "count": len(tool_entries),
        "tools": tool_entries,
    }

    # Persist the catalog as JSON
    catalog_path = os.path.join(os.path.dirname(__file__), "tools.json")
    with open(catalog_path, "w") as f:
        json.dump(catalog, f, indent=2, sort_keys=True)
        f.write("\n")

    # Write the human-readable summary log
    log_path = os.path.join(os.path.dirname(__file__), "output.log")
    with open(log_path, "w") as f:
        f.write("Adapter: langchain\n")
        f.write(f"Connection: {connection_name}\n")
        f.write(f"Identifier: {identifier}\n")
        f.write(f"Tool count: {len(tool_entries)}\n")

    print(f"Catalog written to {catalog_path} ({len(tool_entries)} tools)")
    print(f"Log written to {log_path}")


if __name__ == "__main__":
    main()
