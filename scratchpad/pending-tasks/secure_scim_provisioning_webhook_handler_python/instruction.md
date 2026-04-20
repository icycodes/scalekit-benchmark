Scalekit sends SCIM lifecycle events (like user creation or deletion from an enterprise IdP) to registered webhook endpoints. These must be securely verified to ensure they originate from Scalekit.

You need to implement a FastAPI `POST` endpoint at `/webhooks/scim` that processes incoming Scalekit events. It must parse the incoming request body and headers, verify the cryptographic signature using the Scalekit SDK's webhook verification utilities, and extract the user email if the event type is `user.created`.

**Constraints:**
- You MUST reject requests with invalid or missing signatures by returning an HTTP 401 Unauthorized status.
- Use the `SCALEKIT_WEBHOOK_SECRET` environment variable for signature verification.
- Return an HTTP 200 OK with the payload `{"status": "processed"}` upon successful verification.