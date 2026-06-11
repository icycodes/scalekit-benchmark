FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        scalekit-sdk-python \
        requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/scalekit-task

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit AgentKit Python task environment for posting a Slack message via the slack-test connection."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Scalekit Python SDK (scalekit-sdk-python) for AgentKit calls
#   - requests (used by verification scripts and helpful in user code)
#   - /home/user/scalekit-task: project directory where the executor writes main.py and output.log
