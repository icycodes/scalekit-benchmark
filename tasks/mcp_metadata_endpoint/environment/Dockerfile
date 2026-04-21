FROM local-run-harbor-base


RUN pip3 install --break-system-packages fastapi uvicorn requests

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="MCP metadata endpoint task environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
