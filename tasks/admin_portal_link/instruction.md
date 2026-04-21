# Generate Scalekit Admin Portal Link

## Background
Scalekit provides a hosted Admin Portal that your customers can use to manage their own SSO and SCIM settings. You can generate a secure, short-lived link to this portal for a specific organization.

## Requirements
- Initialize the Scalekit Node.js SDK.
- Generate an Admin Portal link for the organization `org_1234567890`.
- The link should be for the `sso` and `directory_sync` features.
- Write the generated link to `/home/user/scalekit-admin/portal_link.txt`.

## Implementation Guide
1. Create a directory `/home/user/scalekit-admin`.
2. Initialize a Node.js project and install `@scalekit-sdk/node`.
3. Create a file `generate_portal.js` that:
    - Initializes a `Scalekit` instance.
    - Uses `scalekit.organization.generatePortalLink()` with `organization_id: 'org_1234567890'` and `features: ['sso', 'directory_sync']`.
    - Writes the resulting link to `/home/user/scalekit-admin/portal_link.txt`.
4. Run the script using `node generate_portal.js`.

## Constraints
- Project path: /home/user/scalekit-admin
- Portal link file: /home/user/scalekit-admin/portal_link.txt

## Integrations
- Scalekit
