const { ScalekitClient } = require('@scalekit-sdk/node');
const scalekit = new ScalekitClient('https://example.com', 'client_id', 'client_secret');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(scalekit.tools)));
