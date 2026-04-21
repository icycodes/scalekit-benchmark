# Implement SCIM Webhook Handler with Signature Verification

## Background
Scalekit sends webhooks for SCIM events (e.g., user created, updated, or deleted). To ensure these requests are authentic, you must verify the webhook signature using your webhook secret.

## Requirements
- Create an Express.js application in `/home/user/scalekit-webhook`.
- Implement a POST `/webhook` endpoint.
- The endpoint should:
    - Receive the raw request body.
    - Extract the `X-Scalekit-Signature` header.
    - Use the Scalekit SDK's `scalekit.webhooks.verifySignature()` method to verify the payload.
    - The webhook secret is provided via the `SCALEKIT_WEBHOOK_SECRET` environment variable.
    - If verification succeeds, log the event type to `/home/user/scalekit-webhook/events.log`.
    - Return a 200 status code on success, and 401 on verification failure.

## Implementation Guide
1. Create a directory `/home/user/scalekit-webhook`.
2. Initialize a Node.js project and install `express`, `body-parser`, and `@scalekit-sdk/node`.
3. Create a file `server.js` that:
    - Sets up Express with `body-parser.raw({ type: 'application/json' })` to get the raw body.
    - Initializes the `Scalekit` client.
    - Implements the `/webhook` route.
    - Uses `scalekit.webhooks.verifySignature(rawBody, signature, process.env.SCALEKIT_WEBHOOK_SECRET)`.
    - Appends the event type (e.g., `user.created`) to `/home/user/scalekit-webhook/events.log`.
4. Start the server on port 3001.

## Constraints
- Project path: /home/user/scalekit-webhook
- Events log: /home/user/scalekit-webhook/events.log
- Port: 3001
- Start command: node server.js

## Integrations
- Scalekit
