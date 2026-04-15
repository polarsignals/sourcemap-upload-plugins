# @polarsignals/sourcemap-core

Shared core library for [Polar Signals](https://polarsignals.com) source map upload tools. Provides debug ID generation, injection into JavaScript and source map files, and upload to the Polar Signals debuginfo server.

This package is used internally by [`@polarsignals/sourcemap-esbuild-plugin`](https://www.npmjs.com/package/@polarsignals/sourcemap-esbuild-plugin) and [`@polarsignals/sourcemap-cli`](https://www.npmjs.com/package/@polarsignals/sourcemap-cli). Most users should use one of those packages instead.

## Installation

```bash
npm install @polarsignals/sourcemap-core
```

## API

### Post-build processing

```ts
import { processBuiltFiles } from '@polarsignals/sourcemap-core';

const results = await processBuiltFiles('./dist', {
  verbose: true,
  overwrite: false,
});

console.log(results.processed); // number of files processed
console.log(results.debugIds);  // { [filePath]: debugId }
```

### Upload

```ts
import { uploadSourceMaps } from '@polarsignals/sourcemap-core';

await uploadSourceMaps(bundles, {
  serverUrl: 'grpc.polarsignals.com:443',
  token: process.env.POLARSIGNALS_TOKEN,
  projectID: process.env.POLARSIGNALS_PROJECT_ID,
});
```

### Utilities

```ts
import {
  generateDebugId,
  extractDebugIdFromJs,
  extractDebugIdFromSourceMap,
  findJavaScriptFiles,
  injectDebugIdIntoJs,
  injectDebugIdIntoSourceMap,
} from '@polarsignals/sourcemap-core';
```

## License

Apache-2.0

