FROM local-run-harbor-base


RUN pip3 install --break-system-packages fastapi uvicorn scalekit-sdk-python requests

RUN mkdir -p /home/user/mcp-auth && chmod 0755 /home/user/mcp-auth

RUN cat >/home/user/mcp-auth/instruction.md <<'EOF'
# Secure MCP Server Instructions

1.  Implement a FastAPI server in `main.py`.
2.  Add a GET `/.well-known/oauth-protected-resource` endpoint that returns:
    - `authorization_servers`: `[f"{os.environ['SCALEKIT_ENVIRONMENT_URL']}/resources/res_123"]`
    - `bearer_methods_supported`: `["header"]`
    - `resource`: `"https://mcp.example.com"`
    - `scopes_supported`: ["todo:read", "todo:write"]
3.  Implement a middleware that validates the Bearer token using `scalekit_client.validate_token`.
4.  Implement a POST `/tools/execute` endpoint that:
    - Checks for the `todo:write` scope in the token.
    - Returns `{"status": "success"}` if authorized.
5.  Ensure the server runs on port 8080.
EOF

LABEL Author="any-task-builder"
LABEL Description="Complete MCP auth task environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
