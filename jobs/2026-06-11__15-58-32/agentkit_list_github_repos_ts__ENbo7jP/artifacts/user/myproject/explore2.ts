import { Scalekit } from '@scalekit-sdk/node';

async function main() {
  const scalekit = new Scalekit(
    process.env.SCALEKIT_ENV_URL!,
    process.env.SCALEKIT_CLIENT_ID!,
    process.env.SCALEKIT_CLIENT_SECRET!
  );

  const identifier = 'zealt-user01';
  const connectionName = 'github-test';

  try {
    console.log("Listing tools...");
    const tools = await scalekit.tools.listTools({
      filter: {
         identifier,
         connector: connectionName
      }
    });
    
    console.log("Tools:", JSON.stringify(tools, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main().then(() => console.log("Done")).catch(e => console.error(e));