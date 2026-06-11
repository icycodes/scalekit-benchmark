# Delete a Scalekit Connected Account (AgentKit, Node.js)

## Background
In Scalekit AgentKit, a *connected account* is the per-user record that stores OAuth credentials for a given connection (e.g. `github-test`). When a user removes an integration from your app, you must clean up that record so the next sign-in starts from a clean slate. List and delete operations for connected accounts are exposed only through the Node.js SDK (`@scalekit-sdk/node`).

Write a small Node.js / TypeScript program that creates a per-user record for a unique test identifier on the `github-test` connection, verifies it is listed, deletes it, and verifies it is gone.

## Requirements
- Use the official `@scalekit-sdk/node` SDK and initialize it from the standard Scalekit environment variables (`SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`).
- Pick a stable test identifier derived from the `run-id` to avoid collisions with other concurrent trials (see Implementation Hints).
- For that identifier on the `github-test` connection:
  1. Use the idempotent "get or create" helper to ensure the connected account exists.
  2. List connected accounts for the `github-test` connection and confirm the new identifier appears.
  3. Delete that connected account using the SDK's delete helper.
  4. List connected accounts again and confirm the identifier is gone.
- Append a structured log line for each of those four steps to a single log file (see Acceptance Criteria for the exact format).
- The program must run end-to-end as a one-off job (no long-running server). Exit code `0` on success.

## Implementation Hints
- Build the identifier as `zealt-cleanup-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The connection name is `github-test` (case-sensitive — must match the dashboard exactly; do not use the provider slug `github`).
- Initialize the client with `new ScalekitClient(envUrl, clientId, clientSecret)`.
- Relevant SDK calls (all live under `scalekit.actions`):
  - `getOrCreateConnectedAccount({ connectionName, identifier })`
  - `listConnectedAccounts({ connectionName })`
  - `deleteConnectedAccount({ connectionName, identifier })`
- `listConnectedAccounts` returns a paginated response; iterate or scan until you find the identifier (or confirm it is absent). Make sure your "after delete" check actually inspects every page.
- A freshly created account is normally in `PENDING` status until the user completes OAuth — that is fine; you just need to prove it was created and then removed.
- Use the Scalekit Node.js SDK only — do not call the GitHub API directly, and do not touch the existing `zealt-user01` connected account.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Run command: `npm start` (or whatever script your `package.json` defines for the one-off entrypoint).
- Ensure the script is executed end-to-end and the log artifact below exists.
- Log file: `/home/user/myproject/output.log`
- The log file MUST contain, in this order, exactly one line for each step, using these prefixes (the identifier value is determined by `run-id`):
  - `Created account: connection=github-test identifier=<identifier> status=<status>`
  - `Listed before delete: present=true identifier=<identifier>`
  - `Deleted account: connection=github-test identifier=<identifier>`
  - `Listed after delete: present=false identifier=<identifier>`
- The identifier MUST be `zealt-cleanup-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- After the program finishes, calling `listConnectedAccounts({ connectionName: 'github-test' })` on the Scalekit side MUST NOT return that identifier.
- The pre-existing `zealt-user01` connected account on `github-test` MUST remain untouched.

