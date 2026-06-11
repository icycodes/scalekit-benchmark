const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient(process.env.SCALEKIT_ENV_URL, process.env.SCALEKIT_CLIENT_ID, process.env.SCALEKIT_CLIENT_SECRET);
  console.log(client.getAuthorizationUrl('http://localhost:3000/callback', { scopes: ['openid', 'profile', 'email', 'offline_access'] }));
}
run().catch(console.error);
