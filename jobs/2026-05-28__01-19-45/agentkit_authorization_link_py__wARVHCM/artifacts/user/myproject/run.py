import os
from scalekit import ScalekitClient


def _get_value(obj, key):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def main() -> None:
    client_id = os.environ["SCALEKIT_CLIENT_ID"]
    client_secret = os.environ["SCALEKIT_CLIENT_SECRET"]
    env_url = os.environ["SCALEKIT_ENV_URL"]
    run_id = os.environ["ZEALT_RUN_ID"]

    identifier = f"agentkit-link-user-{run_id}"
    connection_name = "github-test"

    scalekit = ScalekitClient(
        client_id=client_id,
        client_secret=client_secret,
        env_url=env_url,
    )

    connected_account = scalekit.actions.get_or_create_connected_account(
        connection_name=connection_name,
        identifier=identifier,
    )

    connected_account_record = (
        _get_value(connected_account, "connected_account") or connected_account
    )

    status = (
        _get_value(connected_account_record, "status")
        or _get_value(connected_account, "connected_account_status")
        or _get_value(connected_account, "state")
    )

    authorization = scalekit.actions.get_authorization_link(
        connection_name=connection_name,
        identifier=identifier,
    )

    authorization_url = (
        _get_value(authorization, "link")
        or _get_value(authorization, "authorization_url")
        or _get_value(authorization, "url")
        or _get_value(authorization, "authorizationUrl")
    )

    lines = [
        f"Identifier: {identifier}",
        f"Status: {status}",
        f"Authorization URL: {authorization_url}",
    ]

    with open("/home/user/myproject/output.log", "w", encoding="utf-8") as log_file:
        log_file.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
