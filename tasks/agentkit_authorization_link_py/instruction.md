# Scalekit AgentKit: Generate an Authorization Link for a New User

## Background
Scalekit AgentKit lets your agent connect to third-party SaaS apps on behalf of a user. Before the agent can act, you must (a) create or fetch a `connected_account` for a `(connection, identifier)` pair, and (b) if the account is not yet `ACTIVE`, generate a hosted authorization link the user can use to authorize OAuth.

In this task you will use the Scalekit Python SDK to bootstrap the OAuth flow for a brand-new identifier against the `github-test` connection. Because the identifier is new, the connected account must start in the `PENDING` state and you must surface a real Scalekit-hosted authorization URL for the user to complete the OAuth flow.

## Requirements
- Use the Scalekit Python SDK (`scalekit-sdk-python`) and read `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`, and `SCALEKIT_ENV_URL` from environment variables.
- Use the connection name `github-test` exactly as it is registered in the dashboard.
- Use a brand-new identifier based on the `run-id` so the resulting connected account is freshly created and starts in `PENDING`.
- Call `get_or_create_connected_account` and then `get_authorization_link` for that same identifier and connection.
- Persist the result of the run to a log file so the verifier can inspect it.

## Implementation Hints
- Initialize `ScalekitClient` with the three environment variables.
- The `connection_name` is workspace-specific and case-sensitive. The provided fixture is `github-test` — do not use the provider slug `github`.
- Read the `run-id` from the `ZEALT_RUN_ID` environment variable and append it to the identifier so concurrent task runs do not collide and the account starts in `PENDING`.
- Use `scalekit.actions.get_or_create_connected_account(...)` to bootstrap the account record and `scalekit.actions.get_authorization_link(...)` to obtain the hosted OAuth link.
- Do not perform the OAuth flow; just generate the link.
- Write all output to the project log file.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the script is actually executed against the live Scalekit environment and the log artifact exists (no mocking).
- Log file: /home/user/myproject/output.log
- The identifier used **MUST** be `agentkit-link-user-${run-id}` where `${run-id}` is read from the `ZEALT_RUN_ID` environment variable.
- The connection used **MUST** be `github-test`.
- The log file MUST contain the following three lines, each on its own line and in this exact label format:
  - `Identifier: <identifier>`
  - `Status: <connected_account_status>`
  - `Authorization URL: <https authorization link>`
- After the script runs, the corresponding connected account on Scalekit MUST exist and be in the `PENDING` state (i.e., not yet authorized).
- The `Authorization URL` value MUST be an `https://` URL pointing to a Scalekit-hosted endpoint.

