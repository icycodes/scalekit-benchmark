import { ScalekitClient } from '@scalekit-sdk/node';
import * as fs from 'fs';

// Try to find the type definition in node_modules
const dts = fs.readFileSync('/home/user/myproject/node_modules/@scalekit-sdk/node/dist/index.d.ts', 'utf-8');
console.log(dts.substring(0, 100));
