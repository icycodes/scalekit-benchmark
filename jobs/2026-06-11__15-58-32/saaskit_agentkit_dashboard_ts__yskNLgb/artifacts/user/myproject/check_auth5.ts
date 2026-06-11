import { ScalekitClient } from '@scalekit-sdk/node';

async function run() {
  type T = Awaited<ReturnType<typeof ScalekitClient.prototype.authenticateWithCode>>;
  const t: T = { fake: 123 } as any;
  const x: number = t;
}
