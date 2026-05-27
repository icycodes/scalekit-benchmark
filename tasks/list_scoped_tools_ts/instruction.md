# Enumerate Scalekit Scoped Tools (Node.js / TypeScript)

## Background
Scalekit's AgentKit exposes pre-built, LLM-ready tools through the `@scalekit-sdk/node` SDK. Before an agent can call any tool on behalf of a user, the developer must discover which tools that user is actually authorized to call via `scalekit.tools.listScopedTools(...)`.

The Scalekit environment for this task has been pre-configured with two connections (`github-test`, `slack-test`) and a fully `ACTIVE` connected account for the test user `zealt-user01` on each connection. Your job is to write a TypeScript program that enumerates every tool scoped to that user across both connections and produces a stable JSON catalog plus a short summary log.

## Requirements
- Build a Node.js TypeScript program that uses the official `@scalekit-sdk/node` SDK.
- The program must read the Scalekit credentials from the standard environment variables `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET`.
- Use the identifier `zealt-user01` and hardcode the connection names `github-test` and `slack-test` (do NOT introduce new environment variables for them).
- Call `scalekit.tools.listScopedTools(...)` once per connection and make sure you fetch every available tool (the default page size will hide tools for the larger connectors, so request enough per page or paginate).
- Persist the resulting tool catalog as JSON and a human-readable summary as a log file.

## Implementation Hints
- Initialize the SDK with `new ScalekitClient(envUrl, clientId, clientSecret)`.
- The Node SDK accepts a `pageSize` option on `listScopedTools` — pass a value large enough to surface every tool (e.g. `100`).
- Each returned tool object exposes its name at `tool.tool.definition.name`.
- Write the catalog with `JSON.stringify(catalog, null, 2)` so the output file is deterministic and easy to inspect.
- A compiled JavaScript entrypoint (e.g. `dist/index.js`) or a `ts-node`/`tsx`-runnable script is acceptable, as long as it executes the listing logic when the script is run.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Ensure the program is actually executed so that the JSON catalog and log artifact exist after the run.
- Log file: `/home/user/myproject/output.log`
- Catalog file: `/home/user/myproject/tools.json`
- `tools.json` must be a valid JSON object whose top-level keys are exactly `"github-test"` and `"slack-test"`, each mapping to an array of tool-name strings returned by the Scalekit SDK for the test user `zealt-user01`.
- Every tool name listed under `"github-test"` must start with `github_` and every tool name listed under `"slack-test"` must start with `slack_`.
- Each array must contain a non-trivial number of distinct tool names (more than 5).
- `output.log` must contain, on separate lines, the two summary records in the exact format:
  - `GitHub tools: <count>`
  - `Slack tools: <count>`
  where `<count>` is the integer length of the corresponding array in `tools.json`.

