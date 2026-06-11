import os
import json
from scalekit import ScalekitClient

def main():
    # Retrieve environment variables
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")

    if not all([env_url, client_id, client_secret]):
        raise ValueError("Missing required SCALEKIT environment variables")

    # Initialize Scalekit Client
    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret
    )

    connection_name = "github-test"
    identifier = "zealt-user01"
    
    # Retrieve tools using LangChain adapter
    # page_size must be large enough to cover every GitHub tool in a single page
    tools = client.actions.langchain.get_tools(
        identifier=identifier,
        connection_names=[connection_name],
        page_size=100
    )

    # Process and filter tools
    processed_tools = []
    for tool in tools:
        if tool.name.startswith("github_"):
            processed_tools.append({
                "name": tool.name,
                "description": tool.description
            })

    # Sort tools in ascending order by name
    processed_tools.sort(key=lambda x: x["name"])

    # Build tools.json structure
    catalog = {
        "connection": connection_name,
        "identifier": identifier,
        "count": len(processed_tools),
        "tools": processed_tools
    }

    # Write tools.json
    catalog_path = "/home/user/myproject/tools.json"
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, sort_keys=True)

    # Write output.log
    log_path = "/home/user/myproject/output.log"
    with open(log_path, "w", encoding="utf-8") as f:
        f.write("Adapter: langchain\n")
        f.write(f"Connection: {connection_name}\n")
        f.write(f"Identifier: {identifier}\n")
        f.write(f"Tool count: {len(processed_tools)}\n")

    print(f"Successfully generated {catalog_path} and {log_path}")

if __name__ == "__main__":
    main()
