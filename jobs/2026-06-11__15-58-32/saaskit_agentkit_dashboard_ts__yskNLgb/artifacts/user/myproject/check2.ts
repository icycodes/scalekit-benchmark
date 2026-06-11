import { ScalekitClient } from '@scalekit-sdk/node';
const client = new ScalekitClient('https://env.scalekit.com', 'id', 'secret');

// Just to get type errors and see what TS says
client.tools.listScopedTools({ connection: 'github-test', identifier: 'zealt-user01', pageSize: 100 });
