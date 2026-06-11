FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        pytest-xprocess \
        requests \
        flask \
        python-dotenv \
        scalekit-sdk-python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject && chmod 0755 /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Scalekit SaaSKit Python Flask login task environment with scalekit-sdk-python, Flask, and pytest-xprocess preinstalled."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - pip3 packages for the task and verifier: pytest-xprocess, requests, flask, python-dotenv, scalekit-sdk-python
#   - /home/user/myproject: empty project directory where the executor builds the Flask SaaSKit login app
