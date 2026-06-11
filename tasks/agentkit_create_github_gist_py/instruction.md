# Create a GitHub Gist via Scalekit AgentKit (Python)

## Background
Scalekit AgentKit lets your code act on behalf of a user against third-party SaaS apps without managing OAuth tokens directly. The Scalekit workspace already has a `github-test` connection with an `ACTIVE` connected account for the identifier `zealt-user01`. Write a Python script that uses the Scalekit Python SDK to create a new public GitHub gist on behalf of `zealt-user01`.

## Requirements
- Use the Scalekit Python SDK (`scalekit-sdk-python`) to act as `zealt-user01` against the `github-test` connection.
- Confirm the connected account is `ACTIVE` before invoking any tool.
- Create one new **public** GitHub gist that contains a single Markdown file. The file name and the gist description must each include the current `run-id` so that parallel trials never collide.
- After the gist is created, append the gist's public HTML URL to a log file in a stable, parseable format.
- The Scalekit configuration values come from environment variables: `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`, `SCALEKIT_ENV_URL`. The `run-id` comes from `ZEALT_RUN_ID`.

## Implementation Hints
- Initialize the SDK with the three `SCALEKIT_*` environment variables and use the `actions` namespace exposed by the client.
- Use `get_or_create_connected_account` to look up the existing connected account for the `github-test` connection and identifier `zealt-user01`, then inspect its status.
- Discover the right GitHub gist creation tool name with `list_scoped_tools` (pass `page_size=100` and filter by connection name to avoid silently truncating the catalog). Execute it through `execute_tool`.
- All hard-coded strings (connection name, identifier) must match the dashboard fixtures exactly. Connection names are case-sensitive.
- Never introduce new environment-variable names; only consume the ones listed above.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the script is executed and the gist is actually created on GitHub; the verifier inspects GitHub directly.
- Log file: /home/user/myproject/output.log
- The gist must be created under the GitHub account associated with `zealt-user01` through the `github-test` connection.
- The gist must be **public**.
- The gist must contain exactly one file whose name is `scalekit-${run-id}.md` where `${run-id}` is read from the `ZEALT_RUN_ID` environment variable.
- The gist's description must contain the substring `scalekit-agentkit-${run-id}`.
- The log file must contain a line in the exact format `Gist URL: <gist_html_url>` where `<gist_html_url>` is the value of `html_url` returned by GitHub for the newly created gist.

