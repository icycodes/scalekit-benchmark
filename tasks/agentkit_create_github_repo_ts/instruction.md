# Create a GitHub Repository via Scalekit AgentKit (Node.js SDK)

## Background
Scalekit AgentKit lets an AI agent take authenticated actions in third-party SaaS apps (GitHub, Slack, Gmail, ...) on behalf of a specific user. A **connection** (configured in the Scalekit dashboard) supplies provider credentials, and a **connected account** binds a `(connection, identifier)` pair so Scalekit can store the user's OAuth tokens and proxy API calls.

In this task you will write a small Node.js (TypeScript) program that uses the Scalekit Node SDK (`@scalekit-sdk/node`) to create a brand-new GitHub repository for the test user `zealt-user01`, going entirely through Scalekit's AgentKit tool execution path (no direct GitHub API calls).

The dashboard has been preconfigured with:
- A GitHub connection named **`github-test`**.
- An already-`ACTIVE` connected account for `(github-test, zealt-user01)`.

You must use these exact, hard-coded values; do **NOT** introduce any new environment variables for them.

## Requirements
- Initialize a `ScalekitClient` using the three Scalekit environment variables `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET`.
- Verify (or create) the connected account for `connection_name = "github-test"` and `identifier = "zealt-user01"`, asserting its status is `ACTIVE` before proceeding.
- Discover the correct Scalekit-optimized tool for "create a new repository for the authenticated user" on the `github-test` connection by calling `listScopedTools` with `pageSize: 100`, then execute that tool via `actions.executeTool` to create a new **public** repository in the `zealt-user01` account.
- The repository name **MUST** be `scalekit-repo-${run-id}`, where `run-id` is read from the `ZEALT_RUN_ID` environment variable. This is required so that concurrent task runs do not collide.
- After the tool call succeeds, write the resulting repository's HTML URL to a log file.

## Implementation Hints
- Install and use the official Node SDK: `@scalekit-sdk/node`.
- The connected account is already `ACTIVE`; calling `getOrCreateConnectedAccount` is idempotent and safe.
- The exact Scalekit tool name for creating a GitHub repository is not always obvious. Use `scalekit.tools.listScopedTools("zealt-user01", { filter: { connectionNames: ["github-test"] }, pageSize: 100 })` to enumerate available tools and select the one that creates a repository for the authenticated user.
- When calling `actions.executeTool`, pass the `connector` (connection name) and `identifier` so Scalekit picks the right connected account, and put the repository parameters (name, private/public, etc.) in `toolInput`.
- Read `run-id` from `process.env.ZEALT_RUN_ID` and build the repository name as `scalekit-repo-${runId}`.
- The tool response contains a structured `data` object; extract the new repository's `html_url` (or equivalent URL field) from it and write it to the log file.
- Run the program with a TypeScript runner such as `npx tsx index.ts` (already available in the environment).

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Ensure the script is executed end-to-end and the artifacts exist (do not stub Scalekit or GitHub).
- Log file: `/home/user/myproject/output.log`
- The repository **MUST** be created under the `zealt-user01` GitHub account with the name `scalekit-repo-${run-id}`, where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The repository **MUST** be public.
- The log file **MUST** contain a line in the format: `Repository URL: <html_url>` where `<html_url>` is the GitHub URL of the newly created repository.

