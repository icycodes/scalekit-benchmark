# Secure your MCP Server with Scalekit

## Background
Your goal is to secure a Model Context Protocol (MCP) server using Scalekit's OAuth 2.1 authorization. This ensures that only authorized users can access your tools through AI hosts.

## Requirements
- Implement the MCP OAuth discovery endpoint: `/.well-known/oauth-protected-resource`.
- Implement an authentication middleware that validates the Bearer token in all incoming requests (except discovery).
- Implement a tool execution endpoint `/tools/execute` that checks for the `todo:write` scope before allowing execution.
- Use the Scalekit SDK for all validation logic.

## Implementation Guide
Follow the instructions in `/home/user/mcp-auth/instruction.md` to complete the task.

## Constraints
- Project path: /home/user/mcp-auth
- Port: 8080
- Start command: python3 main.py

## Integrations
- Scalekit
