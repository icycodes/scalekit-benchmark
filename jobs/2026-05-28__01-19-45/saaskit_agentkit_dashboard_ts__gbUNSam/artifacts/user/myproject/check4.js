const { ScalekitClient } = require('@scalekit-sdk/node');
const scalekit = new ScalekitClient('https://example.com', 'client_id', 'client_secret');
console.log(scalekit.tools.executeTool.toString());
console.log(scalekit.tools.listScopedTools.toString());
