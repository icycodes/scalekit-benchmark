const { ScalekitClient } = require('@scalekit-sdk/node');

async function run() {
  const client = new ScalekitClient('https://env.scalekit.com', 'id', 'secret');
  console.log(client.getLogoutUrl('id_token_123', 'http://localhost:3000/goodbye'));
  console.log(client.getLogoutUrl({ idTokenHint: 'id_token_123', postLogoutRedirectUri: 'http://localhost:3000/goodbye' }));
}
run().catch(console.error);
