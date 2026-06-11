import { ScalekitClient } from '@scalekit-sdk/node';

const client = new ScalekitClient('url', 'id', 'secret');
console.log(typeof client.getAuthorizationUrl);
console.log(typeof client.authenticateWithCode);
console.log(typeof client.getLogoutUrl);
console.log(Object.keys(client));
