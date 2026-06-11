# Create a Scalekit Organization with the Python SDK

## Background
Your B2B SaaS uses Scalekit (SaaSKit) for authentication, sessions, and organization management. Scalekit's hosted login flow automatically provisions an organization for each new user, but applications also need a programmatic path to spin up brand-new organizations (workspaces) for power users who self-serve a new tenant. In this task, you will write a small Python script that authenticates against the Scalekit management API using the workspace credentials and creates a new organization, then logs the resulting organization id and metadata.

## Requirements
- Use the official Scalekit Python SDK (`scalekit-sdk-python`) and initialize a `ScalekitClient` from environment variables.
- Create exactly one new Scalekit organization whose name is `harbor-org-${run-id}` (where `run-id` is read from the `ZEALT_RUN_ID` environment variable). The Scalekit `external_id` for the organization must be the same value `harbor-org-${run-id}`.
- Fetch the freshly created organization back by id using the SDK to confirm it is persisted.
- Write the structured outcome (organization id, name, external id) to a log file so the verifier can read it.

## Implementation Hints
- Initialize the SDK by passing the environment URL, client id, and client secret values from `SCALEKIT_ENV_URL`, `SCALEKIT_CLIENT_ID`, and `SCALEKIT_CLIENT_SECRET`.
- Use the `organization` resource on `ScalekitClient` (`scalekit.organization.create_organization`) to create the new tenant; consult the Scalekit Python SDK docs if you need the exact signature.
- The Scalekit SDK's create-organization method accepts an `external_id` so the same logical workspace can be re-resolved later — set it to the run-scoped value so this task is idempotent across retries.
- After creation, call `scalekit.organization.get_organization(...)` (or the SDK equivalent) to round-trip the new id.
- Read `ZEALT_RUN_ID` from the environment and embed it in both the organization name and the external id; never hardcode either.

## Acceptance Criteria
- Project path: /home/user/myproject
- Ensure the real Scalekit API call is executed and the resulting organization exists in the Scalekit workspace.
- Log file: /home/user/myproject/output.log
- The organization name must be `harbor-org-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The organization's `external_id` must be `harbor-org-${run-id}`.
- The log file must contain a line with the created organization id in the format: `Organization ID: <organization_id>` (the id must start with the `org_` prefix used by Scalekit).
- The log file must contain a line with the organization name in the format: `Organization Name: harbor-org-${run-id}`.
- The log file must contain a line with the external id in the format: `External ID: harbor-org-${run-id}`.

