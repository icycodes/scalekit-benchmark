# Verify an Active AgentKit Connected Account (TypeScript)

## Background
Scalekit AgentKit lets your code retrieve a per-user **connected account** record that stores OAuth credentials for a downstream provider. Production code generally uses the idempotent `getOrCreateConnectedAccount` call as the entry point — it either returns an existing account or initiates a fresh one.

The Scalekit dashboard has been pre-seeded with a connection named `github-test` and an already-connected account for identifier `zealt-user01`, so a call against that fixture must come back with status `ACTIVE`. Your job is to prove this end-to-end with a tiny TypeScript script.

## Requirements
- Implement a Node.js + TypeScript script that uses `@scalekit-sdk/node` to call `getOrCreateConnectedAccount` against the `github-test` connection for identifier `zealt-user01`.
- Print the resulting status and connected-account identifier to a log file so the verifier can inspect them.
- Surface the script through an npm script so it can be re-run on demand.

## Implementation Hints
- The `ScalekitClient` constructor takes the environment URL, client id, and client secret — all are provided via environment variables (`SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`).
- The connection name (`github-test`) and identifier (`zealt-user01`) are dashboard fixtures: hard-code them rather than introducing new environment variables.
- The SDK response wraps the account under `connectedAccount`; check the `status` field to confirm it equals `ACTIVE`.
- Compile with `tsc` (or `ts-node`) and configure an `npm run start` script that executes the compiled JavaScript so the verifier can reproduce the run.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the real Scalekit API call is executed (no mocking) and the log artifact exists.
- Log file: /home/user/myproject/output.log
- The project must expose an npm script named `start` that runs the compiled TypeScript entry point and produces the log file at `/home/user/myproject/output.log`.
- The log file must contain a line in the format `Status: ACTIVE`.
- The log file must contain a line in the format `Connection: github-test`.
- The log file must contain a line in the format `Identifier: zealt-user01`.
- The log file must contain a line in the format `Connected Account ID: <id>` where `<id>` is a non-empty value returned by Scalekit.

