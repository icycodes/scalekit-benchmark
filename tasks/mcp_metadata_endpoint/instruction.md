# Implement MCP OAuth Metadata Endpoint

## Background
In the Model Context Protocol (MCP), clients discover the OAuth 2.1 authorization server by calling `.well-known/oauth-protected-resource`. You need to implement this endpoint in a web server.

## Requirements
- Create a FastAPI application in `/home/user/mcp-server`.
- Implement a GET endpoint at `/.well-known/oauth-protected-resource`.
- The endpoint must return a JSON object with the following fields:
    - `authorization_servers`: `["https://auth.example.com/resources/res_123"]`
    - `bearer_methods_supported`: `["header"]`
    - `resource`: `"https://mcp.example.com"`
    - `scopes_supported`: `["todo:read", "todo:write"]`

## Implementation Guide
1. Create a directory `/home/user/mcp-server`.
2. Create a virtual environment and install `fastapi` and `uvicorn`.
3. Create a file `main.py` that:
    - Initializes a FastAPI app.
    - Defines the `@app.get("/.well-known/oauth-protected-resource")` route.
    - Returns the specified JSON object.
4. Start the server on port 8000.

## Constraints
- Project path: /home/user/mcp-server
- Port: 8000
- Start command: uvicorn main:app --host 0.0.0.0 --port 8000

## Integrations
- Scalekit
