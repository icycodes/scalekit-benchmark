const { ScalekitClient } = require('@scalekit-sdk/node');
const client = new ScalekitClient('https://test.scalekit.com', 'client_id', 'client_secret');
console.log(client.getLogoutUrl('idToken123', 'http://localhost:3000/goodbye'));
console.log(client.getLogoutUrl({ idTokenHint: 'idToken123', postLogoutRedirectUri: 'http://localhost:3000/goodbye' }));
