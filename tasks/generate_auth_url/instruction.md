# Generate Scalekit Authorization URL

## Background
Scalekit provides a method to generate a URL to redirect users for SSO login. This URL includes parameters like the redirect URI and organization ID.

## Requirements
- Initialize the Scalekit Node.js SDK.
- Generate an authorization URL with the following parameters:
    - `redirect_uri`: `http://localhost:3001/callback`
    - `organization_id`: `org_1234567890`
    - `state`: `random_state_string`
- Write the generated URL to a log file.

## Implementation Guide
1. Create a directory `/home/user/scalekit-auth-url`.
2. Initialize a Node.js project and install `@scalekit-sdk/node`.
3. Create a file `generate_url.js` that:
    - Initializes a `Scalekit` instance using environment variables.
    - Uses `scalekit.getAuthorizationUrl()` to generate the URL with the specified parameters.
    - Writes the resulting URL to `/home/user/scalekit-auth-url/output.log`.
4. Run the script using `node generate_url.js`.

## Constraints
- Project path: /home/user/scalekit-auth-url
- Log file: /home/user/scalekit-auth-url/output.log

## Integrations
- Scalekit
