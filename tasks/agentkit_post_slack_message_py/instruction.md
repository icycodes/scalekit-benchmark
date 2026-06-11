# Post a Slack Message via Scalekit AgentKit (Python)

## Background
Scalekit AgentKit lets agents call third-party SaaS APIs on behalf of users through pre-built, schema-typed connector tools. A Slack connector named `slack-test` is already wired in the workspace, and a connected account for the identifier `zealt-user01` is in `ACTIVE` state.

You need to write a Python script that uses the Scalekit Python SDK (`scalekit-sdk-python`) to first create a Slack channel, then post a message to that channel using the AgentKit Slack tools — both calls must go through the AgentKit `execute_tool` API.

## Requirements
- Write a Python script `main.py` in the project directory that uses the official `scalekit-sdk-python` package.
- Initialize the `ScalekitClient` from the `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET` environment variables.
- Discover the Slack tools available to `zealt-user01` (e.g., via `list_scoped_tools`) so you choose tool names that actually exist for the `slack-test` connection.
- Use AgentKit's `execute_tool` to:
  1. Create a new public Slack channel whose name includes the current run-id as a suffix.
  2. Post a single text message into that newly created channel.
- Capture the channel ID and the posted message's timestamp (`ts`) returned by the Slack API and write them to the log file.
- The script must be executed (not just defined). The Slack side effects must be real — no mocking.

## Implementation Hints
- The Slack connection name configured in the dashboard is `slack-test`. The connected account identifier is `zealt-user01`. These values are workspace-specific and should be hard-coded — do not introduce new environment variables for them.
- Read the current `run-id` from the `ZEALT_RUN_ID` environment variable. Use it as a suffix in the channel name so that parallel runs do not collide.
- The Scalekit Python SDK exposes `scalekit.actions.execute_tool(tool_name=..., identifier=..., connection_name=..., tool_input=...)` and `scalekit.actions.tools.list_scoped_tools(identifier=..., filter={"connection_names": ["slack-test"]}, page_size=100)`. The exact Slack tool names returned by `list_scoped_tools` (for example, channel creation and message posting tools) should be used as-is.
- Always pass `page_size=100` when listing scoped tools so large connectors do not silently hide tools.
- Slack channel names must be lowercase, use hyphens, and be at most 80 characters.
- The response object from `execute_tool` carries the underlying provider payload in a `data` attribute (e.g., `result.data`). The channel object lives under a key such as `channel` and includes `id` and `name`; a posted message includes a `ts` (timestamp) field.

## Acceptance Criteria
- Project path: /home/user/scalekit-task
- Ensure the script is executed and the resulting Slack side effects exist.
- Log file: /home/user/scalekit-task/output.log
- A new public Slack channel must exist with the name `harbor-msg-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- A message containing the substring `Hello from Harbor evaluation run ${run-id}` must be present in that channel.
- The log file must contain the following two lines (in any order), with the values produced by the real Slack API calls:
  - `Channel ID: <channel_id>`
  - `Message TS: <message_ts>`

