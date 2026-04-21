# Manage Scalekit Organizations

## Background
Scalekit allows you to manage multi-tenant organizations programmatically. You can create new organizations and list existing ones.

## Requirements
- Initialize the Scalekit Node.js SDK.
- Create a new organization with the name `Harbor Test Org` and an external ID derived from the `trial_id` found in `/logs/trial_id`.
- List all organizations and verify that the newly created organization is in the list.
- Write the ID of the created organization to `/home/user/scalekit-orgs/org_id.txt`.

## Implementation Guide
1. Create a directory `/home/user/scalekit-orgs`.
2. Initialize a Node.js project and install `@scalekit-sdk/node`.
3. Read the `trial_id` from `/logs/trial_id`.
4. Create a file `manage_orgs.js` that:
    - Initializes a `Scalekit` instance.
    - Creates an organization using `scalekit.organization.createOrganization()` with `display_name: 'Harbor Test Org'` and `external_id: 'ext_org_' + trial_id`.
    - Lists organizations using `scalekit.organization.listOrganizations()`.
    - Finds the created organization in the list and writes its `id` to `/home/user/scalekit-orgs/org_id.txt`.
5. Run the script using `node manage_orgs.js`.

## Constraints
- Project path: /home/user/scalekit-orgs
- Org ID file: /home/user/scalekit-orgs/org_id.txt

## Integrations
- Scalekit
