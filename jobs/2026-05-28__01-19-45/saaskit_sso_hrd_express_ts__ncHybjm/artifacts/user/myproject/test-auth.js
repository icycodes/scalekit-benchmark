const { ScalekitClient } = require('@scalekit-sdk/node');
const scalekit = new ScalekitClient('https://env.scalekit.com', 'client_id', 'client_secret');
console.log(scalekit.getAuthorizationUrl('http://localhost:3000/callback', { scopes: ['openid', 'profile', 'email', 'offline_access'] }));
