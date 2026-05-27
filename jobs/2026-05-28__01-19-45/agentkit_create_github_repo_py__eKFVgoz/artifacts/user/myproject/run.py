import json
import os
import sys
from typing import Any, Dict, Optional

from google.protobuf.json_format import MessageToDict
from scalekit.client import ScalekitClient
from scalekit.v1.tools.tools_pb2 import ScopedToolFilter

CONNECTION_NAME = "github-test"
CONNECTED_ACCOUNT_IDENTIFIER = "zealt-user01"
LOG_PATH = "/home/user/myproject/output.log"


def unwrap_response(response):
    if isinstance(response, tuple):
        return response[0]
    return response


def struct_to_dict(struct_value) -> Dict[str, Any]:
    if struct_value is None:
        return {}
    return MessageToDict(struct_value, preserving_proto_field_name=True)


def find_input_schema(definition: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for key in ("input_schema", "inputSchema", "input", "parameters", "schema"):
        value = definition.get(key)
        if isinstance(value, dict):
            return value
    return None


def extract_properties(schema: Dict[str, Any]) -> Dict[str, Any]:
    if not schema:
        return {}
    if isinstance(schema.get("properties"), dict):
        return schema["properties"]
    if isinstance(schema.get("schema"), dict):
        return extract_properties(schema["schema"])
    return {}


def pick_tool_name(tool_definition: Dict[str, Any], tool_metadata: Dict[str, Any], tool_id: str) -> Optional[str]:
    for key in ("name", "tool_name", "toolName"):
        if isinstance(tool_definition.get(key), str):
            return tool_definition[key]
        if isinstance(tool_metadata.get(key), str):
            return tool_metadata[key]
    return tool_id


def has_repo_create_signature(tool_definition: Dict[str, Any], tool_metadata: Dict[str, Any], tool_tags: Any) -> bool:
    combined_text = json.dumps(tool_definition).lower() + json.dumps(tool_metadata).lower()
    if tool_tags:
        combined_text += " " + " ".join(tool_tags).lower()
    return "repo" in combined_text and "create" in combined_text


def detect_param_key(properties: Dict[str, Any], candidates, keyword_hint: Optional[str] = None) -> Optional[str]:
    for candidate in candidates:
        if candidate in properties:
            return candidate
    if keyword_hint:
        for prop, details in properties.items():
            text = json.dumps(details).lower()
            if keyword_hint in text:
                return prop
    return None


def build_tool_params(tool_definition: Dict[str, Any], repo_name: str) -> Dict[str, Any]:
    schema = find_input_schema(tool_definition) or {}
    properties = extract_properties(schema)

    name_key = detect_param_key(properties, ["name", "repo_name", "repository_name"], "repository")
    private_key = detect_param_key(properties, ["private", "is_private", "private_repo"], "private")
    readme_key = detect_param_key(
        properties,
        ["auto_init", "autoInit", "initialize_with_readme", "initializeWithReadme"],
        "readme",
    )

    if not name_key:
        raise RuntimeError("Unable to determine repository name parameter from tool schema.")

    params: Dict[str, Any] = {
        name_key: repo_name,
    }
    if private_key:
        params[private_key] = False
    if readme_key:
        params[readme_key] = True

    return params


def main() -> None:
    env_url = os.environ.get("SCALEKIT_ENV_URL")
    client_id = os.environ.get("SCALEKIT_CLIENT_ID")
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET")
    run_id = os.environ.get("ZEALT_RUN_ID")

    missing = [key for key, value in {
        "SCALEKIT_ENV_URL": env_url,
        "SCALEKIT_CLIENT_ID": client_id,
        "SCALEKIT_CLIENT_SECRET": client_secret,
        "ZEALT_RUN_ID": run_id,
    }.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    repo_name = f"agentkit-repo-{run_id}"

    client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    scoped_tools_response = unwrap_response(
        client.tools.list_scoped_tools(
            identifier=CONNECTED_ACCOUNT_IDENTIFIER,
            filter=ScopedToolFilter(connection_names=[CONNECTION_NAME]),
            page_size=100,
        )
    )

    selected_tool_name = None
    selected_definition: Dict[str, Any] = {}

    for scoped_tool in scoped_tools_response.tools:
        tool = scoped_tool.tool
        definition = struct_to_dict(tool.definition)
        metadata = struct_to_dict(tool.metadata)
        tool_name = pick_tool_name(definition, metadata, tool.id)

        if not tool_name:
            continue

        if has_repo_create_signature(definition, metadata, tool.tags):
            schema = find_input_schema(definition) or {}
            properties = extract_properties(schema)
            if "name" in properties or any("name" in prop for prop in properties):
                selected_tool_name = tool_name
                selected_definition = definition
                break

    if not selected_tool_name:
        raise RuntimeError("Unable to locate a GitHub create-repository tool in the scoped tools list.")

    params = build_tool_params(selected_definition, repo_name)

    execute_response = unwrap_response(
        client.tools.execute_tool(
            tool_name=selected_tool_name,
            identifier=CONNECTED_ACCOUNT_IDENTIFIER,
            connection_name=CONNECTION_NAME,
            params=params,
        )
    )

    response_data = struct_to_dict(execute_response.data)
    full_name = response_data.get("full_name") or response_data.get("fullName")
    html_url = response_data.get("html_url") or response_data.get("htmlUrl")

    if not full_name or not html_url:
        raise RuntimeError(f"Missing repository details in response: {response_data}")

    with open(LOG_PATH, "w", encoding="utf-8") as log_file:
        log_file.write(f"Repository: {full_name} {html_url}\n")

    print(f"Repository: {full_name} {html_url}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
