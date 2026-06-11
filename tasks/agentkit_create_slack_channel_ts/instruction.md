# Create a Slack Channel with Scalekit AgentKit (TypeScript SDK)

## Background
Scalekit AgentKit lets your agent call third-party SaaS APIs on a user's behalf without ever touching raw OAuth tokens. You call a named tool (e.g., `slack_create_channel`) and Scalekit injects the stored credential for the matching connected account and proxies the request to Slack.

In this task you will use the **Scalekit Node.js SDK** (`@scalekit-sdk/node`) from **TypeScript** to create a new public Slack channel for the test user `zealt-user01` through the preconfigured `slack-test` connection.

## Requirements
- Implement a TypeScript program at `/home/user/myproject/src/index.ts` that:
  - Initializes a Scalekit client from the `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET` environment variables.
  - Reads `run-id` from the `ZEALT_RUN_ID` environment variable and uses it to derive a unique channel name.
  - Executes the Scalekit-optimized Slack tool `slack_create_channel` on behalf of the user `zealt-user01` via the `slack-test` connection to create a new **public** Slack channel.
  - Appends the newly created channel id and channel name to a log file as plain text.
- Run the program once (it is a one-off job that creates a real Slack channel through Scalekit).

## Implementation Hints
- Install `@scalekit-sdk/node` along with the TypeScript toolchain (e.g., `typescript`, `tsx`, `@types/node`).
- Use the SDK's `actions.executeTool({ toolName, identifier, connector, toolInput })` API; do **not** call the Slack Web API directly.
- The Slack `slack_create_channel` tool accepts a `name` field (no `#` prefix) and an optional `is_private` boolean — leave the channel public.
- Channel names must be lowercase, contain no spaces, and use only `a-z`, `0-9`, `-`, and `_`.
- The `connection_name` / `connector` value is workspace-specific and case-sensitive; use exactly `slack-test`.
- Inspect the tool response to find the created channel's `id` (Slack `Cxxxxxxxx` format) and `name`, then write them to the log file.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the program is executed and the Slack channel is actually created via Scalekit AgentKit (not via the Slack Web API directly).
- Log file: /home/user/myproject/output.log
- The Slack channel name must be `harbor-slack-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The channel must be **public** and created on behalf of `zealt-user01` through the `slack-test` Scalekit connection.
- The log file must contain a line in the format `Channel ID: <channel_id>` where `<channel_id>` is the Slack channel id returned by Scalekit (it starts with `C`).
- The log file must also contain a line in the format `Channel Name: harbor-slack-<run-id>`.

