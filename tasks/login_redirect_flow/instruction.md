# Implement Scalekit Login Redirect Flow

## Background
In a typical web application using Scalekit, the login process starts with a redirect to Scalekit's authorization server. You must also implement CSRF protection by generating a random `state` and storing it in the user's session.

## Requirements
- Create an Express.js application in `/home/user/scalekit-app`.
- Implement a GET `/login` endpoint.
- The endpoint should:
    - Generate a random `state` string.
    - Store the `state` in the session (use `express-session`).
    - Use the Scalekit SDK to generate an authorization URL with:
        - `redirect_uri`: `http://localhost:3001/callback`
        - `state`: the generated state.
        - `organization_id`: from the query parameter `organization_id`.
    - Redirect the user to the generated URL.

## Implementation Guide
1. Create a directory `/home/user/scalekit-app`.
2. Initialize a Node.js project and install `express`, `express-session`, and `@scalekit-sdk/node`.
3. Create a file `server.js` that:
    - Sets up Express with `express-session`.
    - Initializes the `Scalekit` client.
    - Implements the `/login` route as described.
4. Start the server on port 3001.

## Constraints
- Project path: /home/user/scalekit-app
- Port: 3001
- Start command: node server.js

## Integrations
- Scalekit
