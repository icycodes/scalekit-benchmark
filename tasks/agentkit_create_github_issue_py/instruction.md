# AgentKit: Create a GitHub Issue Through Scalekit

## Background
Scalekit's AgentKit lets an LLM agent perform authenticated, scoped actions on third-party SaaS apps by injecting the user's stored credentials into pre-built "optimized tools". Your dashboard fixtures include a `github-test` connection with an `ACTIVE` connected account for the identifier `zealt-user01`.

You will build a Python script that proves AgentKit can be driven end-to-end from code: it discovers the right GitHub issue-creation tool with `list_scoped_tools`, then invokes it with `execute_tool` to file a new issue on a repository the script itself just created.

## Requirements
- Implement the script at `/home/user/myproject/main.py`.
- Read `run-id` from the `ZEALT_RUN_ID` environment variable. Append it to every named resource.
- Create a brand-new public GitHub repository under `zealt-user01` named `agentkit-issue-target-${run-id}`, initialized with a README. Use the GitHub CLI for this step (the `GH_TOKEN` environment variable is already set up for `zealt-user01`).
- Initialize the Scalekit SDK using only the provided environment variables (`SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`, `SCALEKIT_ENV_URL`). Hard-code the connection name `github-test` and identifier `zealt-user01` — these come from the dashboard fixtures and are not exposed as env vars.
- Call AgentKit's scoped-tool listing to discover the GitHub tool that creates an issue. Use a `page_size` large enough that the GitHub connector's tool list is not silently truncated.
- Use AgentKit's tool execution to file an issue on the new repository with:
  - Title: `AgentKit Test Issue ${run-id}`
  - Body: `Filed via Scalekit AgentKit for run ${run-id}`
- Append the issue's HTML URL to `/home/user/myproject/output.log` on a line of the form `Issue URL: <issue_url>` (no trailing whitespace).

## Implementation Hints
- The Scalekit Python SDK is available as `scalekit-sdk-python`; initialize a client with `client_id`, `client_secret`, and `env_url`, then use `client.actions` for AgentKit calls.
- Connection names are workspace-specific. Do not introduce a new env var for the connection name; use the literal string from the dashboard fixtures.
- `list_scoped_tools` returns the JSON-Schema definitions for every tool the user is authorized to call. The default page size hides tools on connectors that ship many tools — pass `page_size=100`.
- The tool you need has a name that begins with `github_` and clearly mentions issue creation. Pick it programmatically rather than hard-coding a guessed name; the dashboard's catalog is the source of truth.
- `execute_tool` accepts either `(identifier + connection_name)` or `connected_account_id`. Either works.
- Use the GitHub CLI (`gh`) to create the target repository before driving AgentKit. The CLI is preauthenticated as `zealt-user01`.

## Acceptance Criteria
- Project path: `/home/user/myproject`
- Ensure the script is executed and the artifacts exist.
- Log file: `/home/user/myproject/output.log`
- The GitHub repository `zealt-user01/agentkit-issue-target-${run-id}` must exist and be public, where `${run-id}` is read from the `ZEALT_RUN_ID` environment variable.
- The repository must contain an issue whose title is exactly `AgentKit Test Issue ${run-id}`.
- The log file must contain a line of the form `Issue URL: https://github.com/zealt-user01/agentkit-issue-target-${run-id}/issues/<number>`.

