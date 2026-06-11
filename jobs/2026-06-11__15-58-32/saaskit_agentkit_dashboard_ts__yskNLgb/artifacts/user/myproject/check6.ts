import { ScalekitClient } from '@scalekit-sdk/node';
type T = Parameters<typeof ScalekitClient.prototype.tools.listScopedTools>[1]['filter'];
const a: T = 123;
