import { ScalekitClient } from "@scalekit-sdk/node";
import { ConnectorStatus } from "@scalekit-sdk/node/lib/pkg/grpc/scalekit/v1/connected_accounts/connected_accounts_pb";
import * as fs from "fs";
import * as path from "path";

const CONNECTION_NAME = "github-test";
const IDENTIFIER = "zealt-user01";

async function main(): Promise<void> {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;

  if (!envUrl || !clientId || !clientSecret) {
    console.error(
      "Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET"
    );
    process.exit(1);
  }

  const client = new ScalekitClient(envUrl, clientId, clientSecret);

  const response = await client.actions.getOrCreateConnectedAccount({
    connectionName: CONNECTION_NAME,
    identifier: IDENTIFIER,
  });

  const account = response.connectedAccount;

  if (!account) {
    console.error("No connected account returned in the response.");
    process.exit(1);
  }

  const statusName = ConnectorStatus[account.status] ?? "UNKNOWN";
  const logLines = [
    `Status: ${statusName}`,
    `Connection: ${account.connector}`,
    `Identifier: ${account.identifier}`,
    `Connected Account ID: ${account.id}`,
  ];

  const logContent = logLines.join("\n") + "\n";
  const logPath = path.resolve(__dirname, "..", "output.log");

  fs.writeFileSync(logPath, logContent, "utf-8");
  console.log(`Log written to ${logPath}`);
  console.log(logContent);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
