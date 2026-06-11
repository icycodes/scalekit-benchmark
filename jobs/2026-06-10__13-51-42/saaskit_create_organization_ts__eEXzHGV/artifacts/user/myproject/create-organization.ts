import { ScalekitClient } from "@scalekit-sdk/node";
import { writeFileSync } from "node:fs";

async function main() {
  const envUrl = process.env.SCALEKIT_ENV_URL;
  const clientId = process.env.SCALEKIT_CLIENT_ID;
  const clientSecret = process.env.SCALEKIT_CLIENT_SECRET;
  const runId = process.env.ZEALT_RUN_ID;

  if (!envUrl || !clientId || !clientSecret) {
    console.error("Missing required environment variables: SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, SCALEKIT_CLIENT_SECRET");
    process.exit(1);
  }

  if (!runId) {
    console.error("Missing required environment variable: ZEALT_RUN_ID");
    process.exit(1);
  }

  const displayName = `harbor-saaskit-org-${runId}`;
  console.log(`Creating organization with display name: ${displayName}`);

  const scalekit = new ScalekitClient(envUrl, clientId, clientSecret);

  const response = await scalekit.organization.createOrganization(displayName);

  const organizationId = response.organization?.id;
  if (!organizationId) {
    console.error("Failed to create organization: no organization ID returned");
    process.exit(1);
  }

  console.log(`Organization created successfully with ID: ${organizationId}`);

  writeFileSync("/home/user/myproject/output.log", `Organization ID: ${organizationId}\n`, "utf-8");
  console.log("Organization ID written to output.log");
}

main().catch((err) => {
  console.error("Error creating organization:", err);
  process.exit(1);
});
