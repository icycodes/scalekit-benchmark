FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Bootstrap the TypeScript project with the Scalekit Node SDK preinstalled.
RUN mkdir -p /home/user/myproject/src && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "agentkit-create-slack-channel",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts"
  }
}
EOF

RUN cd /home/user/myproject && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
EOF

RUN cd /home/user/myproject && \
    npm install --silent --no-audit --no-fund \
        @scalekit-sdk/node \
        typescript \
        tsx \
        @types/node

LABEL Author="generate-harbor-tasks"
LABEL Description="TypeScript project preinstalled with @scalekit-sdk/node for creating a Slack channel via Scalekit AgentKit."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for the TypeScript task environment
#   - /home/user/myproject: TypeScript project with @scalekit-sdk/node, typescript, tsx and @types/node preinstalled
#   - /home/user/myproject/package.json and tsconfig.json: scaffolded TS project files
#   - /home/user/myproject/src: empty source directory where the executor will create src/index.ts
