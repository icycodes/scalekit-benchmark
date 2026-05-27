const { ScalekitClient } = require('@scalekit-sdk/node');
const scalekit = new ScalekitClient('https://env.scalekit.com', 'client_id', 'client_secret');
console.log(scalekit.getLogoutUrl('my_id_token', 'http://localhost:3000/goodbye'));
