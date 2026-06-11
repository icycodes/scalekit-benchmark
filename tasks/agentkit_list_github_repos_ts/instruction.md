# List GitHub Repositories via Scalekit AgentKit (TypeScript)

## Background
Scalekit AgentKit lets an agent call third-party SaaS APIs on behalf of a connected user without managing OAuth tokens directly. Your job is to write a small Node.js / TypeScript program that uses the Scalekit Node SDK to fetch the GitHub repositories owned by the test user `zealt-user01` through a pre-existing `github-test` connection, and save the result to a log file.

## Requirements
- Use the official Scalekit Node SDK (`@scalekit-sdk/node`) initialized from the provided environment variables (`SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`).
- Use the pre-configured connection `github-test` and the pre-active connected account for identifier `zealt-user01` (hardcode these values — they are not provided as environment variables).
- Use the Scalekit `executeTool` action to invoke a GitHub repository-listing tool (such as `github_list_repos_for_authenticated_user`) for that user.
- Write the structured result to a log file so the list of repositories can be inspected.

## Implementation Hints
- Initialize the Scalekit client with the env URL, client id, and client secret.
- Discover the right tool name by listing scoped tools for `zealt-user01` filtered by the `github-test` connection if you are unsure, then call `executeTool` with the tool name, the identifier, and the connection.
- Pass an input that requests at least a reasonable number of repositories per page (for example, `per_page` set to 100).
- Print each repository's `name` on its own line in the log file in the exact format described below; you may also include the raw JSON response after the list for debugging.
- Connection names are workspace-specific and case-sensitive — use `github-test` exactly.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the script is actually executed against the live Scalekit environment and the log artifact exists.
- Log file: /home/user/myproject/output.log
- The log file MUST contain a line for every repository returned by the Scalekit tool call in the exact format `Repo: <repo_name>`, one repository per line.
- The log file MUST contain a line in the format `Total: <N>` where `<N>` is the total number of repositories returned.
- The script MUST use the Scalekit Node SDK `executeTool` action (not raw GitHub REST/GraphQL calls) to fetch the repositories.

