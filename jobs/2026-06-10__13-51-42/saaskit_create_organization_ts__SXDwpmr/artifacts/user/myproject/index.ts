import { ScalekitClient } from "@scalekit-sdk/node";
import * as fs from "fs";

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
  const runId = process.env.ZEALT_RUN_ID;

  if (!envUrl || !clientId || !clientSecret) {
    console.error("Error: Missing Scalekit environment variables (SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET)");
    process.exit(1);
  }

  if (!runId) {
    console.error("Error: Missing ZEALT_RUN_ID environment variable");
    process.exit(1);
  }

  const orgName = `harbor-saaskit-org-${runId}`;
  console.log(`Creating organization: ${orgName}`);

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  try {
    const response = await scalekit.organization.createOrganization(orgName);
    const orgId = response.organization?.id;

    if (!orgId) {
      throw new Error("No organization ID returned from the Scalekit API response");
    }

    console.log(`Successfully created organization in Scalekit. ID: ${orgId}`);

    const logPath = "/home/user/myproject/output.log";
    fs.writeFileSync(logPath, `Organization ID: ${orgId}\n`, "utf8");
    console.log(`Logged organization ID to ${logPath}`);
  } catch (error) {
    console.error("An error occurred while creating the organization:", error);
    process.exit(1);
  }
}

main();
