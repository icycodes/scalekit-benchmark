# Enumerate Scalekit Connected Accounts (Node.js / TypeScript)

## Background
Scalekit's AgentKit stores a per-user `connected account` for every `(connection, identifier)` pair after the user finishes authorization. As an operator you frequently need to audit which users have already linked a given provider (e.g. who has connected GitHub through `github-test`). The list/delete operations for connected accounts are currently available **only in the Node.js SDK** (`@scalekit-sdk/node`), which makes this a TypeScript-only workflow.

The Scalekit environment for this task has been pre-configured with two connections (`github-test`, `slack-test`) and a fully `ACTIVE` connected account for the test user `zealt-user01` on each connection. Your job is to write a TypeScript program that uses the Node.js Scalekit SDK to enumerate every connected account under the `github-test` connection and persist a stable JSON catalog plus a short summary log.

## Requirements
- Build a Node.js TypeScript program that uses the official `@scalekit-sdk/node` SDK.
- Read the Scalekit credentials from the standard environment variables `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET`.
- Hardcode the connection name `github-test`. Do NOT introduce a new environment variable for the connection name.
- Use the Scalekit `actions.listConnectedAccounts` API (Node.js only) to fetch every connected account registered against the `github-test` connection.
- Persist the result as a deterministic JSON catalog and write a human-readable summary line to a log file.

## Implementation Hints
- Initialize the SDK with `new ScalekitClient(envUrl, clientId, clientSecret)` and use `scalekit.actions.listConnectedAccounts({ connectionName: 'github-test' })`.
- The response object exposes the list of connected accounts; each account carries an `identifier` field that uniquely identifies the user.
- Write the catalog with `JSON.stringify(catalog, null, 2)` so the output file is deterministic.
- A compiled JavaScript entrypoint (e.g. `dist/index.js`) or a `ts-node`/`tsx`-runnable script is acceptable, as long as it executes the listing logic when the script is run.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the program is actually executed so that the JSON catalog and log artifact exist after the run.
- Catalog file: /home/user/myproject/accounts.json
- Log file: /home/user/myproject/output.log
- `accounts.json` must be a valid JSON object with the following shape:

  ```json
  {
    "connection_name": "github-test",
    "identifiers": ["<identifier-1>", "<identifier-2>", ...]
  }
  ```

  - `connection_name` must equal the string `github-test`.
  - `identifiers` must be a JSON array of strings — every connected-account identifier returned by the Scalekit SDK for the `github-test` connection. The array must contain the test user `zealt-user01`.
- `output.log` must contain, on a line of its own, the summary record in the exact format:
  - `GitHub connected accounts: <count>`
  where `<count>` is the integer length of the `identifiers` array in `accounts.json` (and must be at least 1).

