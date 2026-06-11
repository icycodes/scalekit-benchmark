# Scalekit AgentKit: Verify an Existing Connected Account is ACTIVE (Python)

## Background
Before an AI agent can call third-party SaaS APIs on behalf of a user, the corresponding Scalekit `connected account` must reach the `ACTIVE` state. A common pre-flight check in production code is: given a `(connection, identifier)` pair, confirm that Scalekit has already stored valid credentials so the agent can proceed straight to tool calls instead of generating an authorization link.

In this task you will use the Scalekit Python SDK to perform that pre-flight check against the dashboard fixture: the `github-test` connection has a pre-configured connected account for the test user `zealt-user01` that is already in the `ACTIVE` state. Your script must fetch that connected account via the SDK, assert the status is `ACTIVE`, and persist a small log artifact that the verifier can inspect.

## Requirements
- Use the Scalekit Python SDK (`scalekit-sdk-python`) and read `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`, and `SCALEKIT_ENV_URL` from environment variables.
- Use the exact connection name `github-test` and the exact identifier `zealt-user01` as registered in the dashboard fixture. Do **NOT** introduce new environment variables for these names.
- Use `get_or_create_connected_account` to fetch the connected account (it is idempotent and the safe default when the account may or may not already exist).
- If the returned status is not `ACTIVE`, fail loudly (non-zero exit) instead of silently proceeding.
- Persist a small log artifact so the verifier can inspect the result.

## Implementation Hints
- Initialize `ScalekitClient` with the three environment variables. The Python SDK accepts keyword arguments like `env_url=...`, `client_id=...`, `client_secret=...`.
- The `connection_name` is workspace-specific and case-sensitive — use `github-test` exactly. Do not pass the provider slug `github`.
- The Scalekit response object exposes the connected account on `response.connected_account` (snake_case). Its `status` field carries the state (compare against `"ACTIVE"` or the equivalent enum).
- Do **NOT** generate an authorization link and do **NOT** call any third-party API directly — only use the Scalekit SDK to read the connected account.
- Write the log file with UTF-8 text and one record per line.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the script is actually executed against the live Scalekit environment and the log artifact exists (no mocking).
- Log file: /home/user/myproject/output.log
- The script MUST exit with status 0 if the connected account is `ACTIVE`, and exit with a non-zero status otherwise.
- The log file MUST contain the following four lines, each on its own line and in this exact label format:
  - `Connection: github-test`
  - `Identifier: zealt-user01`
  - `Status: ACTIVE`
  - `Connected Account ID: <non-empty connected-account id>`
- The Scalekit-side state of the `(github-test, zealt-user01)` connected account MUST still be `ACTIVE` after the script runs (the script must not mutate it).

