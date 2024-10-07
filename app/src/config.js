// experimental
//import config from './config.json' with { type: "json" };

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import fs from 'fs';
const config = JSON.parse(fs.readFileSync(require.resolve('./config.json'), 'utf8'));

export default config;
