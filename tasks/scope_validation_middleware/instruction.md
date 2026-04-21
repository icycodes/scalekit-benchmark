# Implement Scope-Based Validation Middleware

## Background
To secure your API endpoints, you must validate the access tokens sent by clients. Scalekit provides a `validateToken` method that can check the token's validity and ensure it has the required scopes.

## Requirements
- Create an Express.js application in `/home/user/scalekit-middleware`.
- Implement an authentication middleware `authMiddleware` that:
    - Extracts the Bearer token from the `Authorization` header.
    - Uses `scalekit.validateToken()` to validate the token.
    - Checks if the token has the `todo:read` scope.
    - If valid, calls `next()`.
    - If invalid or missing scope, returns a 401 or 403 status code.
- Apply this middleware to a GET `/todos` endpoint that returns a list of todos.

## Implementation Guide
1. Create a directory `/home/user/scalekit-middleware`.
2. Initialize a Node.js project and install `express` and `@scalekit-sdk/node`.
3. Create a file `server.js` that:
    - Initializes the `Scalekit` client.
    - Defines the `authMiddleware` using `scalekit.validateToken(token, { requiredScopes: ['todo:read'] })`.
    - Implements the `/todos` route protected by the middleware.
4. Start the server on port 3001.

## Constraints
- Project path: /home/user/scalekit-middleware
- Port: 3001
- Start command: node server.js

## Integrations
- Scalekit
