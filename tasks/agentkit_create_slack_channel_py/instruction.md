# Create a Slack Channel via Scalekit AgentKit (Python)

## Background
Scalekit AgentKit lets your AI agent call third-party SaaS APIs on behalf of a user. Tokens, refresh, and HTTP plumbing are handled by Scalekit; your code only invokes named tools.

In this task you will write a small Python script that uses the Scalekit Python SDK to create a brand-new Slack channel **as the user `zealt-user01`** through a pre-configured Slack connection named `slack-test`.

The Scalekit credentials (`SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`, `SCALEKIT_ENV_URL`) are already present in the environment. The Slack connection and the `zealt-user01` connected account are already `ACTIVE`, so no OAuth flow is required from your script.

## Requirements
- Write the script at `/home/user/myproject/run.py`.
- The script must use the Scalekit Python SDK (`scalekit-sdk-python`) to create a new **public** Slack channel.
- The Slack channel name must be `agentkit-task-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The script must execute the action against the real Scalekit / Slack environment (no mocking, no stubs).
- After a successful create call, the script must write a single-line summary to a log file containing the resulting Slack channel name and channel ID.

## Implementation Hints
- Initialize `ScalekitClient` with the three Scalekit environment variables.
- The Slack connection in the dashboard is named **exactly** `slack-test` and the connected account identifier is **exactly** `zealt-user01`. Both values must be hardcoded — no additional environment variables exist for them.
- Use the Scalekit AgentKit "execute tool" entry point against the Slack channel-creation tool. If you are unsure of the exact tool name, list the tools scoped to `zealt-user01` for the `slack-test` connection first (use a large `page_size`) and pick the channel-creation tool whose schema accepts a `name` parameter.
- The structured response from `execute_tool` contains the created channel's `id` and `name`.
- Read `ZEALT_RUN_ID` from the environment at runtime — do **not** hardcode the run-id.

## Acceptance Criteria
- Project path: /home/user/myproject
- Script path: /home/user/myproject/run.py
- Log file: /home/user/myproject/output.log
- Ensure the script is actually executed and the Slack channel is really created via Scalekit (no mocks).
- The created Slack channel must be named `agentkit-task-${run-id}` where `run-id` comes from the `ZEALT_RUN_ID` environment variable.
- The created Slack channel must be a public channel (not private, not archived).
- The log file must contain a line in the exact format: `Channel: <channel_name> (<channel_id>)` — for example `Channel: agentkit-task-zr-abc123 (C0123456789)`.

