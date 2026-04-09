# @polarsignals/sourcemap-esbuild-plugin

[esbuild](https://esbuild.github.io/) plugin that automatically injects debug IDs into JavaScript files and source maps, then uploads them to [Polar Signals](https://polarsignals.com). This enables TypeScript/JavaScript symbol resolution in continuous profiling.

## Installation

```bash
npm install @polarsignals/sourcemap-esbuild-plugin
```

## Usage

```js
import esbuild from "esbuild";
import { debugIdPlugin } from "@polarsignals/sourcemap-esbuild-plugin";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  sourcemap: true,
  outfile: "dist/index.js",
  plugins: [
    debugIdPlugin({
      projectID: process.env.POLARSIGNALS_PROJECT_ID,
      token: process.env.POLARSIGNALS_TOKEN,
    }),
  ],
});
```

Debug ID injection and source map upload happen automatically at the end of each build.

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `projectID` | `string` | Yes | Polar Signals project ID |
| `token` | `string` | Yes | Authentication token |
| `debuginfoServerUrl` | `string` | No | Debuginfo server URL (default: `grpc.polarsignals.com:443`) |
| `verbose` | `boolean` | No | Enable verbose logging (default: `false`) |
| `insecure` | `boolean` | No | Skip TLS verification (default: `false`) |

## How It Works

1. After esbuild finishes, the plugin scans the output directory for `.js` + `.js.map` pairs
2. A deterministic debug ID (UUID) is generated from each source map's content
3. The debug ID is injected into both the JavaScript (`//# debugId=...`) and source map (`"debugId": "..."`)
4. The source map bundle is uploaded to Polar Signals, keyed by debug ID

## Not using esbuild?

For `tsc`, rollup, webpack, or any other build tool, use [`@polarsignals/sourcemap-cli`](https://www.npmjs.com/package/@polarsignals/sourcemap-cli) instead.

## License

Apache-2.0
