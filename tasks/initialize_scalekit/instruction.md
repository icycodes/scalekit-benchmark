# Initialize Scalekit SDK

## Background
Scalekit is an enterprise authentication platform. To use its features, you must first initialize the Scalekit client with your environment credentials.

## Requirements
- Initialize the Scalekit Node.js SDK using environment variables.
- Print the Scalekit environment URL to a log file.

## Implementation Guide
1. Create a directory `/home/user/scalekit-init`.
2. Initialize a Node.js project and install `@scalekit-sdk/node`.
3. Create a file `init.js` that:
    - Imports `Scalekit` from `@scalekit-sdk/node`.
    - Initializes a new `Scalekit` instance using `process.env.SCALEKIT_ENVIRONMENT_URL`, `process.env.SCALEKIT_CLIENT_ID`, and `process.env.SCALEKIT_CLIENT_SECRET`.
    - Prints the environment URL (from `process.env.SCALEKIT_ENVIRONMENT_URL`) to `/home/user/scalekit-init/output.log`.
4. Run the script using `node init.js`.

## Constraints
- Project path: /home/user/scalekit-init
- Log file: /home/user/scalekit-init/output.log

## Integrations
- Scalekit
