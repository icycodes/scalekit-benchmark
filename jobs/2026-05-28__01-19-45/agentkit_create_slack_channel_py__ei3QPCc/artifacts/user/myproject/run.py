import os
import sys
from scalekit import ScalekitClient

def main():
    # Retrieve environment variables
    client_id = os.environ.get('SCALEKIT_CLIENT_ID')
    client_secret = os.environ.get('SCALEKIT_CLIENT_SECRET')
    env_url = os.environ.get('SCALEKIT_ENV_URL')
    run_id = os.environ.get('ZEALT_RUN_ID')

    if not all([client_id, client_secret, env_url, run_id]):
        print("Missing environment variables", file=sys.stderr)
        sys.exit(1)

    # Initialize Scalekit Client
    client = ScalekitClient(env_url, client_id, client_secret)

    # Define the channel name
    channel_name = f"agentkit-task-{run_id}"

    try:
        # Execute the Slack channel creation tool
        # Connection name and user identifier are hardcoded as per requirements
        response = client.actions.execute_tool(
            tool_name="slack_create_channel",
            tool_input={
                "name": channel_name,
                "is_private": False
            },
            connection_name="slack-test",
            identifier="zealt-user01"
        )

        data = response.data
        if data and data.get('ok'):
            # Extract channel details
            channel_id = data['channel']['id']
            actual_channel_name = data['channel']['name']

            # Write summary to log file
            log_file_path = "/home/user/myproject/output.log"
            with open(log_file_path, "w") as f:
                f.write(f"Channel: {actual_channel_name} ({channel_id})\n")
            
            print(f"Channel: {actual_channel_name} ({channel_id})")
        else:
            error_msg = data.get('error') if data else "No response data"
            print(f"Error creating channel: {error_msg}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"Exception: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
