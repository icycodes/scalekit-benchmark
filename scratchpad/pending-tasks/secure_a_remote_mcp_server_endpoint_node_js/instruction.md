Remote Model Context Protocol (MCP) servers must be secured using OAuth 2.1 and Dynamic Client Registration to prevent unauthorized tool execution by unauthenticated LLM agents.

You need to implement an Express middleware function `requireMcpAuth` that intercepts incoming HTTP requests to a remote MCP tool execution endpoint. It must use the Scalekit SDK's `mcp.authenticate()` primitive to validate the incoming bearer token before allowing the request to proceed to the next handler.

**Constraints:**
- The middleware MUST extract the Bearer token from the `Authorization` header.
- If authentication fails or the token is missing, the middleware MUST immediately return an HTTP 403 Forbidden response.
- On success, attach the authenticated MCP context to the request object as `req.mcpContext` before calling `next()`.