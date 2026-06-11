FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep gnupg && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    install -dm 0755 /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gh && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages \
        pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Provide the Scalekit Node SDK and common helpers globally so the agent can
# `import { ScalekitClient } from '@scalekit-sdk/node'` without a network
# install at evaluation time. Also install tsx for running TypeScript directly.
RUN npm install -g \
        @scalekit-sdk/node \
        tsx \
        typescript \
        dotenv && \
    npm cache clean --force

# Expose the globally installed npm modules to local Node lookups so that
# `import '@scalekit-sdk/node'` resolves from any cwd without re-installation.
ENV NODE_PATH=/usr/lib/node_modules

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit AgentKit Node SDK environment for creating a GitHub branch via the github-test connection; includes GitHub CLI for repo bootstrap and verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 + npm + npx for the TypeScript task environment
#   - tsx + typescript globally installed so `.ts` scripts can be run directly
#   - @scalekit-sdk/node and dotenv installed globally so they resolve via NODE_PATH=/usr/lib/node_modules
#   - GitHub CLI (gh) for bootstrapping the repo with --add-readme and for verification
#   - /home/user/myproject: empty workspace where the agent will write its TypeScript source and output.log
