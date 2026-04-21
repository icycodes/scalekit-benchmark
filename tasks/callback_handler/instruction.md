# Implement Scalekit Callback Handler

## Background
After a user authenticates with Scalekit, they are redirected back to your application with an authorization code. Your application must exchange this code for tokens and user details.

## Requirements
- Create an Express.js application in `/home/user/scalekit-callback`.
- Implement a GET `/callback` endpoint.
- The endpoint should:
    - Extract `code` and `state` from query parameters.
    - Use `scalekit.authenticateWithCode()` to exchange the code for tokens.
    - Decode the `idToken` using a library like `jsonwebtoken`.
    - Return a JSON response containing the user's email and name from the decoded token.

## Implementation Guide
1. Create a directory `/home/user/scalekit-callback`.
2. Initialize a Node.js project and install `express`, `@scalekit-sdk/node`, and `jsonwebtoken`.
3. Create a file `server.js` that:
    - Initializes the `Scalekit` client.
    - Implements the `/callback` route.
    - Uses `scalekit.authenticateWithCode(code, 'http://localhost:3001/callback')`.
    - Decodes the `idToken` and extracts `email` and `name`.
    - Sends these details back as JSON.
4. Start the server on port 3001.

## Constraints
- Project path: /home/user/scalekit-callback
- Port: 3001
- Start command: node server.js

## Integrations
- Scalekit
