import json
import logging
import os
import re
import sys
from typing import Any, Dict, Iterable, List, Optional, Tuple

from google.protobuf.json_format import MessageToDict
from scalekit import ScalekitClient

IDENTIFIER = "zealt-user01"
GITHUB_CONNECTION = "github-test"
SLACK_CONNECTION = "slack-test"
LOG_PATH = "/home/user/scalekit-task/output.log"


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("harbor_notify")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    file_handler = logging.FileHandler(LOG_PATH, mode="w", encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(file_handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(stream_handler)
    return logger


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def to_plain(value: Any) -> Any:
    """Convert SDK/protobuf/pydantic response values to ordinary Python objects."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {k: to_plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_plain(v) for v in value]
    if hasattr(value, "model_dump"):
        return to_plain(value.model_dump())
    if hasattr(value, "dict"):
        return to_plain(value.dict())
    if hasattr(value, "ListFields"):
        return MessageToDict(value, preserving_proto_field_name=True)
    return value


def parse_possible_json(value: Any) -> Any:
    """Recursively parse JSON strings, including MCP-style content text payloads."""
    value = to_plain(value)
    if isinstance(value, str):
        stripped = value.strip()
        if stripped and stripped[0] in "[{\""[:2] + "\"":
            try:
                return parse_possible_json(json.loads(stripped))
            except Exception:
                return value
        return value
    if isinstance(value, list):
        return [parse_possible_json(v) for v in value]
    if isinstance(value, dict):
        parsed = {k: parse_possible_json(v) for k, v in value.items()}
        # Some MCP tools return provider JSON as data.content[].text.
        content = parsed.get("content")
        if isinstance(content, list) and len(content) == 1:
            first = content[0]
            if isinstance(first, dict) and isinstance(first.get("text"), (dict, list)):
                return first["text"]
        return parsed
    return value


def walk(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, dict):
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)


def find_first_key(value: Any, key: str) -> Optional[Any]:
    for item in walk(value):
        if isinstance(item, dict) and key in item and item[key] not in (None, ""):
            return item[key]
    return None


def execute(scalekit: ScalekitClient, *, tool_name: str, connection_name: str, tool_input: Dict[str, Any]) -> Any:
    response = scalekit.actions.execute_tool(
        tool_name=tool_name,
        identifier=IDENTIFIER,
        connection_name=connection_name,
        tool_input=tool_input,
    )
    return parse_possible_json(getattr(response, "data", response))


def list_scoped_tools(scalekit: ScalekitClient, connection_name: str) -> List[Dict[str, Any]]:
    response = scalekit.actions.tools.list_scoped_tools(
        identifier=IDENTIFIER,
        filter={"connection_names": [connection_name]},
        page_size=100,
    )
    if isinstance(response, tuple):
        response = response[0]
    return [MessageToDict(tool, preserving_proto_field_name=True) for tool in response.tools]


def list_dashboard_tools(scalekit: ScalekitClient, query: str) -> List[Dict[str, Any]]:
    response = scalekit.actions.tools.list_tools(filter={"query": query}, page_size=100)
    if isinstance(response, tuple):
        response = response[0]
    return [MessageToDict(tool, preserving_proto_field_name=True) for tool in response.tools]


def tool_definition(scoped_tool: Dict[str, Any]) -> Dict[str, Any]:
    return scoped_tool.get("tool", scoped_tool).get("definition", {})


def tool_provider(scoped_tool: Dict[str, Any]) -> str:
    return scoped_tool.get("tool", scoped_tool).get("provider", "")


def tool_props(definition: Dict[str, Any]) -> set:
    return set((definition.get("input_schema") or {}).get("properties") or {})


def choose_tool(tools: List[Dict[str, Any]], *, predicates: List[Any]) -> Optional[str]:
    for tool in tools:
        definition = tool_definition(tool)
        name = definition.get("name", "")
        display = definition.get("display_name", "")
        description = definition.get("description", "")
        props = tool_props(definition)
        text = f"{name} {display} {description}".lower()
        if all(predicate(name, text, props, tool) for predicate in predicates):
            return name
    return None


def discover_tools(scalekit: ScalekitClient, logger: logging.Logger) -> Tuple[str, str, str, Optional[str], Optional[str]]:
    github_scoped = list_scoped_tools(scalekit, GITHUB_CONNECTION)
    slack_scoped = list_scoped_tools(scalekit, SLACK_CONNECTION)

    logger.info("Discovered GitHub scoped tools: %s", ", ".join(tool_definition(t).get("name", "") for t in github_scoped))
    logger.info("Discovered Slack scoped tools: %s", ", ".join(tool_definition(t).get("name", "") for t in slack_scoped))

    github_create = choose_tool(
        github_scoped,
        predicates=[
            lambda _name, text, props, _tool: "create" in text and ("repository" in text or "repo" in text),
            lambda _name, _text, props, _tool: {"name", "private"}.issubset(props),
        ],
    )

    # The configured GitHub connector exposes repository read/write tools in scoped discovery,
    # while repository creation is exposed on the dashboard as an AgentKit GitHub MCP tool.
    # This is still selected from live tool discovery and executed through AgentKit with the
    # github-test connection_name; no direct GitHub API calls are made.
    if not github_create:
        dashboard_repo_tools = list_dashboard_tools(scalekit, "Create repository")
        github_create = choose_tool(
            dashboard_repo_tools,
            predicates=[
                lambda _name, text, _props, tool: tool_provider(tool).upper().startswith("GITHUB")
                and "create" in text
                and "repository" in text,
                lambda _name, _text, props, _tool: {"name", "private"}.issubset(props),
            ],
        )
        logger.info("Discovered dashboard repository creation tool: %s", github_create)

    github_get = choose_tool(
        github_scoped,
        predicates=[
            lambda name, text, _props, _tool: name == "github_repo_get"
            or ("get repository" in text and "branch" not in text),
            lambda _name, _text, props, _tool: {"owner", "repo"}.issubset(props) and "branch" not in props,
        ],
    )

    github_readme_get = choose_tool(
        github_scoped,
        predicates=[
            lambda name, text, _props, _tool: name == "github_file_contents_get"
            or ("file" in text and ("contents" in text or "content" in text) and "get" in text),
            lambda _name, _text, props, _tool: {"owner", "repo", "path"}.issubset(props),
        ],
    )

    slack_create = choose_tool(
        slack_scoped,
        predicates=[
            lambda _name, text, _props, _tool: "create" in text and "channel" in text,
            lambda _name, _text, props, _tool: "name" in props,
        ],
    )
    slack_send = choose_tool(
        slack_scoped,
        predicates=[
            lambda _name, text, _props, _tool: ("send" in text or "post" in text) and "message" in text,
            lambda _name, _text, props, _tool: {"channel", "text"}.issubset(props),
        ],
    )

    missing = [
        label
        for label, name in [
            ("GitHub repository creation", github_create),
            ("Slack channel creation", slack_create),
            ("Slack message posting", slack_send),
        ]
        if not name
    ]
    if missing:
        raise RuntimeError("Missing required AgentKit tools after discovery: " + ", ".join(missing))

    return github_create, slack_create, slack_send, github_get, github_readme_get


def extract_repo_url(data: Any) -> Optional[str]:
    for key in ("html_url", "url"):
        value = find_first_key(data, key)
        if isinstance(value, str) and value.startswith("https://github.com/"):
            return value
    return None


def create_or_get_repository(
    scalekit: ScalekitClient,
    logger: logging.Logger,
    tool_name: str,
    get_tool_name: Optional[str],
    readme_get_tool_name: Optional[str],
    repo_name: str,
) -> str:
    try:
        data = execute(
            scalekit,
            tool_name=tool_name,
            connection_name=GITHUB_CONNECTION,
            tool_input={
                "name": repo_name,
                "private": False,
                "autoInit": True,
                "description": f"Harbor notification repository for ZEALT run {require_env('ZEALT_RUN_ID')}",
            },
        )
        logger.info("GitHub repository creation response: %s", json.dumps(data, sort_keys=True))
        repo_url = extract_repo_url(data)
        if repo_url:
            return repo_url
    except Exception as exc:
        # If a previous attempt already created the run-specific repository, continue by
        # retrieving it through AgentKit so the logged URL is still provider-derived.
        logger.info("GitHub repository creation raised: %s", exc)

    if not get_tool_name:
        raise RuntimeError("Repository URL was not returned and no repository get tool is available")

    data = execute(
        scalekit,
        tool_name=get_tool_name,
        connection_name=GITHUB_CONNECTION,
        tool_input={"owner": IDENTIFIER, "repo": repo_name},
    )
    logger.info("GitHub repository get response: %s", json.dumps(data, sort_keys=True))
    repo_url = extract_repo_url(data)
    if not repo_url:
        raise RuntimeError(f"Could not extract GitHub repository URL from response: {data}")

    if readme_get_tool_name:
        readme = execute(
            scalekit,
            tool_name=readme_get_tool_name,
            connection_name=GITHUB_CONNECTION,
            tool_input={"owner": IDENTIFIER, "repo": repo_name, "path": "README.md"},
        )
        logger.info("GitHub README verification response: %s", json.dumps(readme, sort_keys=True))

    return repo_url


def create_slack_channel(scalekit: ScalekitClient, logger: logging.Logger, tool_name: str, channel_name: str) -> str:
    data = execute(
        scalekit,
        tool_name=tool_name,
        connection_name=SLACK_CONNECTION,
        tool_input={"name": channel_name, "is_private": False},
    )
    logger.info("Slack channel creation response: %s", json.dumps(data, sort_keys=True))

    channel_id = None
    channel = find_first_key(data, "channel")
    if isinstance(channel, dict):
        channel_id = channel.get("id")
    if not channel_id:
        channel_id = find_first_key(data, "id")
    if not isinstance(channel_id, str) or not channel_id:
        raise RuntimeError(f"Could not extract Slack channel ID from response: {data}")
    return channel_id


def post_slack_message(
    scalekit: ScalekitClient,
    logger: logging.Logger,
    tool_name: str,
    channel_id: str,
    repo_url: str,
) -> str:
    text = f"New GitHub repository created for ZEALT run: {repo_url}"
    data = execute(
        scalekit,
        tool_name=tool_name,
        connection_name=SLACK_CONNECTION,
        tool_input={"channel": channel_id, "text": text},
    )
    logger.info("Slack message response: %s", json.dumps(data, sort_keys=True))

    ts = find_first_key(data, "ts")
    if not isinstance(ts, str) or not ts:
        raise RuntimeError(f"Could not extract Slack message timestamp from response: {data}")
    return ts


def main() -> None:
    logger = setup_logging()
    env_url = require_env("SCALEKIT_ENV_URL")
    client_id = require_env("SCALEKIT_CLIENT_ID")
    client_secret = require_env("SCALEKIT_CLIENT_SECRET")
    run_id = require_env("ZEALT_RUN_ID")

    suffix = run_id.lower()
    base_name = f"harbor-notify-{suffix}"
    channel_name = re.sub(r"[^a-z0-9-]", "-", base_name)[:80]
    repo_name = base_name

    scalekit = ScalekitClient(env_url, client_id, client_secret)
    github_create, slack_create, slack_send, github_get, readme_get = discover_tools(scalekit, logger)

    repo_url = create_or_get_repository(scalekit, logger, github_create, github_get, readme_get, repo_name)
    channel_id = create_slack_channel(scalekit, logger, slack_create, channel_name)
    message_ts = post_slack_message(scalekit, logger, slack_send, channel_id, repo_url)

    logger.info("Repository URL: %s", repo_url)
    logger.info("Channel ID: %s", channel_id)
    logger.info("Message TS: %s", message_ts)


if __name__ == "__main__":
    main()
