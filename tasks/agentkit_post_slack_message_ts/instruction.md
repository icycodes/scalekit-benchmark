# Post a Slack Message via Scalekit AgentKit (TypeScript)

## Background
Scalekit AgentKit lets agents act on behalf of users by injecting per-user OAuth credentials into pre-built tools across 100+ SaaS connectors. The Scalekit environment used for this task has a Slack connection named `slack-test` and a connected account for the identifier `zealt-user01` whose status is `ACTIVE`.

In this task you will write a TypeScript program that uses the Scalekit Node.js SDK (`@scalekit-sdk/node`) to post a message into a Slack channel through AgentKit's `execute_tool` API.

## Requirements
- Use the Scalekit Node.js SDK (`@scalekit-sdk/node`).
- Initialize a `ScalekitClient` using the `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET` environment variables.
- Use AgentKit to post a message into an existing Slack channel via the Slack `slack-test` connection on behalf of the identifier `zealt-user01`. Hardcode the connection name `slack-test` and the identifier `zealt-user01` (do not introduce new environment variables for them).
- The Slack channel the message is posted to must be named `agentkit-demo-${run-id}` where `${run-id}` is read from the `ZEALT_RUN_ID` environment variable. Create this channel before posting if it does not already exist.
- The message text must contain the exact marker `scalekit-agentkit-ts ${run-id}` (with `${run-id}` substituted) so the verifier can locate it in the channel history.
- After the AgentKit tool call returns, write the resulting Slack message `ts` (timestamp ID) into a log file in the format described below.

## Implementation Hints
- Use `scalekit.actions.executeTool({...})` from `@scalekit-sdk/node`. For Slack, the optimized tool name follows the pattern `slack_<action>`; pick the tool that posts a message to a channel.
- The Slack tool accepts a channel ID (not name) as input. You can call another AgentKit Slack tool (for example, the one that lists or creates channels) through `executeTool` to obtain the channel ID. Alternatively, you can create the channel ahead of the post-message call using the same Scalekit AgentKit flow.
- Pass `identifier: 'zealt-user01'` and either `connector: 'slack-test'` or `connectionName: 'slack-test'` to `executeTool` so Scalekit injects the right OAuth credentials.
- Read `run-id` from the `ZEALT_RUN_ID` environment variable. Use it to build both the channel name and the message marker.
- The `executeTool` response exposes the Slack API result inside `result.data`. Slack returns the posted message metadata, including the message `ts` and the resolved `channel` id.
- TypeScript compiles to JavaScript: you can use `tsx`, `ts-node`, or compile to `dist/` and run with `node` — whichever you prefer, as long as the entrypoint is a single command (see Acceptance Criteria).

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the script is actually executed end-to-end (the Slack message must be posted via AgentKit) and the log artifact exists.
- Log file: /home/user/myproject/output.log
- The Slack channel name must be `agentkit-demo-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The Slack message text must contain the substring `scalekit-agentkit-ts ${run-id}`.
- The log file `output.log` must contain a line of the form `Message TS: <slack_message_ts>` where `<slack_message_ts>` is the `ts` field returned by Slack for the posted message.
- The log file `output.log` must contain a line of the form `Channel: <channel_name>` where `<channel_name>` is `agentkit-demo-${run-id}`.
- The Scalekit Node.js SDK (`@scalekit-sdk/node`) must be the library used to talk to Slack; do not bypass Scalekit by calling Slack's API directly from the task code.

