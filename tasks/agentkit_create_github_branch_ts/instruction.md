# Create a GitHub Branch via Scalekit AgentKit (TypeScript)

## Background

You are building a DevOps assistant that uses Scalekit's [AgentKit](https://docs.scalekit.com/agentkit/overview.md) to perform GitHub operations on behalf of authenticated users. AgentKit stores OAuth tokens per `(connection, identifier)` pair (a "connected account") and exposes pre-built, LLM-ready tools per connector. Calling `scalekit.actions.executeTool({ toolName, identifier, connector, toolInput })` injects the right token and proxies the call to GitHub — no provider credentials touch your code.

The Scalekit dashboard for this environment ships with:
- A connection named `github-test` that wraps GitHub OAuth.
- An `ACTIVE` connected account whose identifier is `zealt-user01`, already linked to GitHub user `zealt-user01`.

Your task: write a small Node.js + TypeScript program that uses `@scalekit-sdk/node` to create a new branch off `main` in a freshly bootstrapped repository owned by `zealt-user01`.

## Requirements

- Read `run-id` from the `ZEALT_RUN_ID` environment variable. All resource names below MUST be derived from this `run-id` so that parallel runs do not collide.
- Bootstrap a target repository owned by `zealt-user01` named `agentkit-branch-test-${run-id}`. The repository MUST be initialized with a README so that a `main` branch with at least one commit exists. You may use the `gh` CLI (which is preconfigured with `GH_TOKEN` for `zealt-user01`) for this bootstrap step only.
- Then, using the Scalekit AgentKit Node SDK (`@scalekit-sdk/node`), create a new branch named `feature-${run-id}` that points at the current HEAD commit of `main` in that same repository. Do not push any additional commits.
- The branch-creation tool call MUST be made via Scalekit: `scalekit.actions.executeTool({ ... })` for the connected account identified by `identifier="zealt-user01"` on the `github-test` connection. Do NOT call the GitHub REST API directly, do NOT use `gh api`, and do NOT use `git push` to create the branch.
- Initialize the Scalekit client from the environment variables `SCALEKIT_ENVIRONMENT_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET`.
- Append a single line to the log file `/home/user/myproject/output.log` in the exact format `Branch created: <value>`, where `<value>` contains the literal text `feature-${run-id}` (with `${run-id}` substituted).

## Implementation Hints

- The Scalekit AgentKit GitHub connector exposes pre-built tools. Use `scalekit.tools.listScopedTools(identifier, { filter: { connectionNames: ['github-test'] }, pageSize: 100 })` to discover the correct tool name for creating a branch and to confirm its input schema. Setting a generous `pageSize` is important — the default page size is small and can hide tools (see the docs' troubleshooting note).
- To create a branch you usually need the SHA of the commit to branch from. The Scalekit GitHub connector includes tools for reading branch metadata as well as creating a branch; use whatever combination of `executeTool` calls is needed to resolve the `main` branch SHA and create the new ref.
- Call `scalekit.actions.executeTool({ toolName, identifier, connector: 'github-test', toolInput })`. The `connector` field MUST match the dashboard connection name exactly (it is `github-test`, not `github`).
- The repository owner is the literal string `zealt-user01`.
- Useful docs: [`agentkit/overview`](https://docs.scalekit.com/agentkit/overview.md), [`agentkit/quickstart`](https://docs.scalekit.com/agentkit/quickstart.md), [`agentkit/tools/scalekit-optimized-tools`](https://docs.scalekit.com/agentkit/tools/scalekit-optimized-tools.md), [`agentkit/connectors/github`](https://docs.scalekit.com/agentkit/connectors/github/).

## Acceptance Criteria

- Project path: /home/user/myproject
- Ensure the script is actually executed against the real Scalekit + GitHub fixtures; the branch must exist on GitHub at the end.
- Log file: /home/user/myproject/output.log
- The `run-id` MUST be read from the `ZEALT_RUN_ID` environment variable.
- After the script runs:
  - A repository `zealt-user01/agentkit-branch-test-${run-id}` MUST exist on GitHub with at least a `main` branch.
  - A branch named `feature-${run-id}` MUST exist in that repository.
  - The new branch MUST point at the same commit SHA as `main` (no extra commits added).
  - `/home/user/myproject/output.log` MUST contain a line of the form `Branch created: <value>` where `<value>` contains the substring `feature-${run-id}`.
- The TypeScript source code under `/home/user/myproject` MUST import `@scalekit-sdk/node`. The branch creation step must be performed through the Scalekit Node SDK (not via `gh`, raw HTTP, or `git push`).

