import os
import re
from urllib.parse import urlparse

import pytest


PROJECT_DIR = "/home/user/myproject"
SCRIPT_FILE = os.path.join(PROJECT_DIR, "run.py")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
CONFIG_BASENAME = "agentkit-mcp"
IDENTIFIER = "zealt-user01"


def _run_id():
    run_id = os.environ.get("ZEALT_RUN_ID", "").strip()
    assert run_id, "ZEALT_RUN_ID is not set in the verification environment."
    return run_id


def _expected_config_name():
    return f"{CONFIG_BASENAME}-{_run_id()}"


def _read_log():
    with open(LOG_FILE, "r", encoding="utf-8") as fh:
        return fh.read()


def _extract_mcp_url():
    contents = _read_log()
    match = re.search(r"^MCP URL:\s+(\S+)\s*$", contents, re.MULTILINE)
    assert match, (
        f"Expected {LOG_FILE} to contain a line matching 'MCP URL: <url>'; "
        f"log contents were: {contents!r}"
    )
    return match.group(1).strip()


def test_script_file_exists_and_uses_scalekit_mcp_api():
    assert os.path.isfile(SCRIPT_FILE), (
        f"Expected the executor's script at {SCRIPT_FILE}, but it was not found."
    )
    with open(SCRIPT_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    assert re.search(r"\bscalekit\b", contents, re.IGNORECASE), (
        f"Expected {SCRIPT_FILE} to import or reference the Scalekit Python SDK "
        f"(module name 'scalekit')."
    )
    assert re.search(r"create[_]?config", contents, re.IGNORECASE), (
        f"Expected {SCRIPT_FILE} to call Scalekit's MCP create_config entry point, "
        f"but no such call was found."
    )
    assert re.search(r"ensure[_]?instance", contents, re.IGNORECASE), (
        f"Expected {SCRIPT_FILE} to call Scalekit's MCP ensure_instance entry point, "
        f"but no such call was found."
    )


def test_script_does_not_bypass_sdk_with_direct_http():
    """The MCP config / instance must be created via the Scalekit SDK, not via direct HTTP calls."""
    with open(SCRIPT_FILE, "r", encoding="utf-8") as fh:
        contents = fh.read()
    forbidden_patterns = [
        (r"requests\.(get|post|put|delete|patch)\s*\(", "direct requests.* HTTP call"),
        (r"urllib\.request", "direct urllib.request HTTP access"),
        (r"\bhttpx\.(get|post|put|delete|patch|Client)\b", "direct httpx HTTP call"),
        (r"['\"]curl['\"]", "shell invocation of curl"),
    ]
    for pattern, description in forbidden_patterns:
        assert not re.search(pattern, contents), (
            f"Found forbidden {description} in {SCRIPT_FILE}; the MCP config and "
            f"instance must be created through the Scalekit Python SDK, not by bypassing it."
        )


def test_log_file_exists_with_expected_lines():
    assert os.path.isfile(LOG_FILE), (
        f"Expected the log file {LOG_FILE} to exist after the task ran."
    )
    contents = _read_log()

    expected_config_line = f"Config: {_expected_config_name()}"
    assert re.search(
        rf"^{re.escape(expected_config_line)}\s*$", contents, re.MULTILINE
    ), (
        f"Expected {LOG_FILE} to contain the line '{expected_config_line}', "
        f"but log contents were: {contents!r}"
    )

    expected_identifier_line = f"Identifier: {IDENTIFIER}"
    assert re.search(
        rf"^{re.escape(expected_identifier_line)}\s*$", contents, re.MULTILINE
    ), (
        f"Expected {LOG_FILE} to contain the line '{expected_identifier_line}', "
        f"but log contents were: {contents!r}"
    )

    mcp_url = _extract_mcp_url()
    parsed = urlparse(mcp_url)
    assert parsed.scheme == "https", (
        f"Expected the MCP URL in {LOG_FILE} to be an https URL, got: {mcp_url!r}"
    )
    assert parsed.hostname and "scalekit" in parsed.hostname.lower(), (
        f"Expected the MCP URL host to contain 'scalekit', got host: {parsed.hostname!r} "
        f"(full URL: {mcp_url!r})"
    )


def test_mcp_instance_exists_on_scalekit():
    """Use the Scalekit Python SDK to confirm the MCP config + instance really exist."""
    try:
        import scalekit.client  # noqa: F401
    except Exception as exc:
        pytest.fail(f"Failed to import scalekit Python SDK: {exc}")

    client_id = os.environ.get("SCALEKIT_CLIENT_ID", "").strip()
    client_secret = os.environ.get("SCALEKIT_CLIENT_SECRET", "").strip()
    env_url = os.environ.get("SCALEKIT_ENV_URL", "").strip()
    assert client_id and client_secret and env_url, (
        "Scalekit credentials (SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET, "
        "SCALEKIT_ENV_URL) must be set for the verifier."
    )

    from scalekit.client import ScalekitClient

    scalekit_client = ScalekitClient(
        env_url=env_url,
        client_id=client_id,
        client_secret=client_secret,
    )

    config_name = _expected_config_name()

    # ensure_instance is idempotent: if the executor already created the config and
    # provisioned the per-user instance, calling it again must return the same instance.
    # If the config does not exist, this call will raise.
    try:
        try:
            inst_response = scalekit_client.actions.mcp.ensure_instance(
                config_name=config_name,
                user_identifier=IDENTIFIER,
            )
        except TypeError:
            # Some SDK versions use `identifier=` instead of `user_identifier=`.
            inst_response = scalekit_client.actions.mcp.ensure_instance(
                config_name=config_name,
                identifier=IDENTIFIER,
            )
    except Exception as exc:
        pytest.fail(
            f"Expected MCP config '{config_name}' to exist on Scalekit so that "
            f"ensure_instance(...) succeeds for identifier '{IDENTIFIER}', "
            f"but the call raised: {exc!r}"
        )

    instance = getattr(inst_response, "instance", None)
    assert instance is not None, (
        f"Expected ensure_instance(...) to return a response with an .instance attribute; "
        f"got: {inst_response!r}"
    )

    # The SDK may expose the URL as either `mcp_url` or `url`.
    sdk_url = getattr(instance, "mcp_url", None) or getattr(instance, "url", None)
    assert sdk_url, (
        f"Expected ensure_instance(...).instance to expose a non-empty MCP URL "
        f"(via either 'mcp_url' or 'url'), got instance: {instance!r}"
    )
    sdk_url = sdk_url.strip()

    parsed = urlparse(sdk_url)
    assert parsed.scheme == "https", (
        f"Expected the MCP URL returned by the SDK to be https, got: {sdk_url!r}"
    )
    assert parsed.hostname and "scalekit" in parsed.hostname.lower(), (
        f"Expected the SDK-returned MCP URL host to contain 'scalekit', got host: "
        f"{parsed.hostname!r} (full URL: {sdk_url!r})"
    )

    logged_url = _extract_mcp_url()
    assert logged_url == sdk_url, (
        f"Expected the MCP URL recorded in {LOG_FILE} to match the URL the Scalekit SDK "
        f"returns for ensure_instance(config_name={_expected_config_name()!r}, "
        f"identifier={IDENTIFIER!r}). Log URL: {logged_url!r}, SDK URL: {sdk_url!r}."
    )
