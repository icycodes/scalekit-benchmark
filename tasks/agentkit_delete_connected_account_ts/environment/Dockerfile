FROM ubuntu:24.04

# Base system, Python toolchain, and Node.js v24 for the Scalekit Node.js SDK.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        scalekit-sdk-python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create the standard user home directory.
RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-create the project directory and install the Scalekit Node.js SDK plus a
# minimal toolchain so the executor can write and run a TypeScript / Node.js
# program against the SDK without an additional network install.
RUN mkdir -p /home/user/myproject && \
    cd /home/user/myproject && \
    npm init -y >/dev/null && \
    npm install --silent \
        @scalekit-sdk/node \
        dotenv \
        typescript \
        ts-node \
        @types/node

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit AgentKit Node.js task environment: delete a per-user connected account on the github-test connection."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for the Scalekit Node.js SDK
#   - Python SDK: scalekit-sdk-python (used by the verifier to confirm deletion)
#   - /home/user/myproject: pre-initialized npm project with @scalekit-sdk/node, dotenv, typescript, ts-node, @types/node installed
