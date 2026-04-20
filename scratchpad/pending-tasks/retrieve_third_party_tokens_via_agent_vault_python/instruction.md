Scalekit's Agent Auth provides AI agents with a secure vault to access third-party services (like Slack or Gmail) on behalf of users without exposing or managing raw credentials in the application logic.

You need to write a Python function `get_slack_token(agent_id, user_id)` that authenticates with the Scalekit SDK and retrieves a delegated access token for the Slack API specifically for the provided user and agent context.

**Constraints:**
- You MUST use the specific Agent Auth / Vault primitives provided by the Scalekit Python SDK.
- The function must return only the raw access token string.
- If the token cannot be retrieved or the user has not authorized the agent, the function must catch the exception and raise a `ValueError("Token unavailable")`.