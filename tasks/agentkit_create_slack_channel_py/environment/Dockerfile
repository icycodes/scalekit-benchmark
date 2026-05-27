FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        scalekit-sdk-python \
        python-dotenv \
        requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject && chmod 0755 /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit AgentKit Python task environment for creating a Slack channel via the slack-test connection on behalf of zealt-user01."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Scalekit Python SDK (scalekit-sdk-python) for AgentKit execute_tool calls
#   - python-dotenv and requests (helpful for executor scripts and verification utilities)
#   - /home/user/myproject: empty starter directory for the executor's run.py and output.log
