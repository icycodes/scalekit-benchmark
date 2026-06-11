FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Prepare the Node.js project used by the task executor.
# - package.json declares ESM type and the Scalekit Node SDK + tsx runner.
# - npm install pre-populates node_modules so test_initial_state.py passes.
RUN mkdir -p /home/user/myproject && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "saaskit-create-organization",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@scalekit-sdk/node": "^1.0.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.5.4"
  }
}
EOF

RUN cd /home/user/myproject && \
    npm install --no-audit --no-fund --loglevel=error && \
    npm link tsx && \
    ln -sf /home/user/myproject/node_modules/.bin/tsx /usr/local/bin/tsx

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit SaaSKit task environment with Node.js v24, tsx, and the @scalekit-sdk/node SDK preinstalled in /home/user/myproject."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - extra pip3 packages: requests (for verifier HTTP checks against Scalekit Management API)
#   - Node.js v24 for executing the TypeScript task
#   - tsx CLI globally available at /usr/local/bin/tsx
#   - /home/user/myproject: pre-initialized Node project with @scalekit-sdk/node installed in node_modules
