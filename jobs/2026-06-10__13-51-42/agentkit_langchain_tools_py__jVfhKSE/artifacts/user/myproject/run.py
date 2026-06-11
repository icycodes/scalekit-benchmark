#!/usr/bin/env python3
"""Enumerate GitHub tools available through Scalekit's LangChain adapter."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from langchain_core.tools import BaseTool
from scalekit import ScalekitClient


PROJECT_DIR = Path(__file__).resolve().parent
CATALOG_PATH = PROJECT_DIR / "tools.json"
LOG_PATH = PROJECT_DIR / "output.log"

CONNECTION = "github-test"
IDENTIFIER = "zealt-user01"
PAGE_SIZE = 1000


def require_env(name: str) -> str:
    """Return a required environment variable or raise a clear error."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def tool_entry(tool: BaseTool) -> dict[str, str]:
    """Build the deterministic catalog representation for one LangChain tool."""
    return {
        "name": str(tool.name),
        "description": str(tool.description or ""),
    }


def main() -> None:
    env_url = require_env("SCALEKIT_ENV_URL")
    client_id = require_env("SCALEKIT_CLIENT_ID")
    client_secret = require_env("SCALEKIT_CLIENT_SECRET")

    scalekit_client = ScalekitClient(env_url, client_id, client_secret)

    # Use the framework adapter directly. Do not call the raw scoped-tool API or
    # reshape protobuf results; these are already native LangChain tools.
    tools = scalekit_client.actions.langchain.get_tools(
        identifier=IDENTIFIER,
        connection_names=[CONNECTION],
        page_size=PAGE_SIZE,
    )

    if not all(isinstance(tool, BaseTool) for tool in tools):
        unexpected: list[str] = [type(tool).__name__ for tool in tools if not isinstance(tool, BaseTool)]
        raise TypeError(f"Expected every adapter result to be a BaseTool; got: {unexpected}")

    entries = sorted((tool_entry(tool) for tool in tools), key=lambda item: item["name"])
    names = [entry["name"] for entry in entries]

    if len(names) != len(set(names)):
        duplicates = sorted({name for name in names if names.count(name) > 1})
        raise RuntimeError(f"Duplicate tool names returned by adapter: {duplicates}")

    non_github_names = [name for name in names if not name.startswith("github_")]
    if non_github_names:
        raise RuntimeError(f"Expected every tool name to start with 'github_'; got: {non_github_names}")

    if len(entries) <= 5:
        raise RuntimeError(f"Expected more than 5 tools, got {len(entries)}")

    catalog: dict[str, Any] = {
        "connection": CONNECTION,
        "identifier": IDENTIFIER,
        "count": len(entries),
        "tools": entries,
    }

    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    LOG_PATH.write_text(
        "\n".join(
            [
                "Adapter: langchain",
                f"Connection: {CONNECTION}",
                f"Identifier: {IDENTIFIER}",
                f"Tool count: {len(entries)}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(entries)} tools to {CATALOG_PATH}")
    print(f"Wrote summary log to {LOG_PATH}")


if __name__ == "__main__":
    main()
