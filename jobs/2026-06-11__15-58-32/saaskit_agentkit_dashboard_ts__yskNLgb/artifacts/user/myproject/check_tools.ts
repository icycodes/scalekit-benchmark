import { ScalekitClient } from '@scalekit-sdk/node';

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL!, process.env.SCALEKIT_CLIENT_ID!, process.env.SCALEKIT_CLIENT_SECRET!);
  const res = await client.tools.listTools({ pageSize: 100 });
  console.log(Object.keys(res));
  console.log("Tools count:", res.tools?.length);
  const repoTools = res.tools?.filter((t: any) => t.toolName?.includes('repo') || t.name?.includes('repo') || t.tool?.name?.includes('repo') || JSON.stringify(t).includes('repo'));
  console.log(JSON.stringify(repoTools?.map((t:any) => t.toolName || t.name || t.tool?.name), null, 2));
}
run().catch(console.error);
