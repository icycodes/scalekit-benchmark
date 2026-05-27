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
LABEL Description="Scalekit AgentKit Python task environment for provisioning an MCP config and per-user MCP instance over the github-test and slack-test connections for zealt-user01."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Scalekit Python SDK (scalekit-sdk-python) for AgentKit MCP API calls (create_config / ensure_instance)
#   - python-dotenv and requests (commonly needed helpers for executor scripts)
#   - /home/user/myproject: empty starter directory for the executor's run.py and output.log
