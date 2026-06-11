FROM ubuntu:24.04

# Install required system packages, Node.js v24, GitHub CLI, Python tooling,
# and the Scalekit Node SDK plus the tsx TypeScript runner.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git gnupg python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gh && \
    npm install -g tsx@4 && \
    pip3 install --break-system-packages pytest-json-ctrf requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-create the project directory and pre-install the Scalekit Node SDK so the
# initial state check (require.resolve('@scalekit-sdk/node')) succeeds.
RUN mkdir -p /home/user/myproject && \
    cd /home/user/myproject && \
    npm init -y > /dev/null && \
    npm install --silent @scalekit-sdk/node dotenv typescript @types/node

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit AgentKit task: create a GitHub repository via the Node.js (TypeScript) SDK in /home/user/myproject."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf, requests
#   - Node.js v24 with tsx (TypeScript runner) installed globally
#   - GitHub CLI (gh) for final-state verification
#   - /home/user/myproject: Node project with @scalekit-sdk/node, dotenv, typescript, @types/node preinstalled
