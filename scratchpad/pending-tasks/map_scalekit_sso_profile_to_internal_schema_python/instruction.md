When integrating Scalekit in "Modular SSO" mode alongside existing databases, the standardized user profile and roles returned by Scalekit must be mapped to the application's internal database schema.

You need to write a purely synchronous Python function `map_scalekit_user(scalekit_result)` that takes the `result` object returned by `scalekit.authentication.authenticate_with_code()` and maps it to a standard internal dictionary format.

**Constraints:**
- The output dictionary MUST strictly contain the exact keys: `internal_id` (mapped from the Scalekit user ID), `email`, `tenant_id` (mapped from the Scalekit organization ID), and `is_admin` (a boolean).
- The `is_admin` boolean MUST evaluate to `True` only if the Scalekit user's roles list contains the exact string `"Admin"`.
- Do NOT make any external database, file system, or network API calls within this function.