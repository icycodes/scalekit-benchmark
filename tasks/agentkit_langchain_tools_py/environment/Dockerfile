FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        scalekit-sdk-python \
        langchain-core \
        python-dotenv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject && chmod 0755 /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit AgentKit Python task environment for enumerating GitHub tools through the LangChain framework adapter (actions.langchain.get_tools) for zealt-user01 on the github-test connection."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Scalekit Python SDK (scalekit-sdk-python) for AgentKit API calls
#   - langchain-core so the LangChain framework adapter can materialize native BaseTool objects
#   - python-dotenv (commonly used helper for executor scripts)
#   - /home/user/myproject: empty starter directory for the executor's run.py, tools.json, and output.log
