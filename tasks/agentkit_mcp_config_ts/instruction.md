# Create a Scalekit AgentKit Virtual MCP Server (TypeScript)

## Background
Scalekit's AgentKit lets you spin up Virtual MCP (Model Context Protocol) servers that expose authenticated, scoped tools from third-party SaaS apps to any MCP-compatible client. Two AgentKit connections (`github-test` and `slack-test`) and their connected accounts for the test user `zealt-user01` are already configured in the Scalekit workspace.

In this task you will write a small Node.js (TypeScript) program that uses the `@scalekit-sdk/node` SDK to create a Virtual MCP server configuration combining tools from both connections, and persist the resulting identifiers to a log file.

## Requirements
- Use the Scalekit Node SDK (`@scalekit-sdk/node`) from a TypeScript project.
- Initialize the SDK client from these environment variables: `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`.
- Create exactly one Virtual MCP server configuration with:
  - A unique name derived from the current `run-id` (see Implementation Hints).
  - A non-empty `description`.
  - Two connection-tool mappings:
    1. Connection `github-test`, exposing only the tool `github_list_repos_for_authenticated_user`.
    2. Connection `slack-test`, exposing only the tool `slack_send_message`.
- After the call succeeds, write the returned `config.id`, `config.name`, and `config.mcp_server_url` to a log file in a stable, line-oriented format.
- The script must be idempotent across re-runs of the same `run-id`: if a config with that name already exists, it is acceptable to reuse it (e.g., list configs and pick the matching one) instead of creating a duplicate.

## Implementation Hints
- Read the current `run-id` from the `ZEALT_RUN_ID` environment variable and use it as a suffix when naming the config (parallel runs must not collide).
- The Scalekit Node SDK exposes MCP helpers under `scalekit.actions.mcp`. The relevant calls are `createConfig(...)`, `listConfigs(...)`, and `deleteConfig(...)`.
- Each connection-tool mapping is an object with `connectionName` and an optional `tools` array (omit `tools` to expose all tools).
- The connection names are case-sensitive and must match the dashboard exactly: `github-test` and `slack-test`.
- Use TypeScript with a `tsx` or `ts-node` runner; alternatively compile to JavaScript and run with `node`. Either way, `npm start` should execute the program end-to-end.
- Do NOT introduce any environment variables besides the three provided Scalekit ones and `ZEALT_RUN_ID`.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the script is executed against the real Scalekit API and the log artifact exists.
- Log file: /home/user/myproject/output.log
- The script must be runnable via `npm start` from the project directory.
- The created MCP config name must equal `harbor-mcp-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The log file must contain the following three lines (one per line, in any order, with no surrounding whitespace on the value):
  - `MCP Config Name: harbor-mcp-${run-id}`
  - `MCP Config ID: <config_id>`
  - `MCP Server URL: <mcp_server_url>`
- The created Virtual MCP configuration on Scalekit must include:
  - A connection-tool mapping for `github-test` whose exposed tools contain `github_list_repos_for_authenticated_user`.
  - A connection-tool mapping for `slack-test` whose exposed tools contain `slack_send_message`.

