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

# Prepare the project directory and pre-install the Scalekit Node.js SDK
# plus a few common runtimes for TypeScript so the executor can pick whichever
# toolchain they prefer (tsx, ts-node, or plain tsc + node).
RUN mkdir -p /home/user/myproject && \
    cd /home/user/myproject && \
    npm init -y >/dev/null && \
    npm install --silent \
        @scalekit-sdk/node \
        typescript \
        tsx \
        ts-node \
        @types/node \
        dotenv

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit AgentKit Node.js task environment for posting a Slack message via @scalekit-sdk/node."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for running the Scalekit TypeScript SDK
#   - /home/user/myproject: project directory with @scalekit-sdk/node pre-installed
#       plus typescript, tsx, ts-node, @types/node, and dotenv
