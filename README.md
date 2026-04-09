# Polar Signals Source Map Upload Plugins

Tools for injecting debug IDs into JavaScript source maps and uploading them to [Polar Signals](https://polarsignals.com). This enables TypeScript/JavaScript symbol resolution in continuous profiling.

## Packages

| Package | Description |
|---------|-------------|
| [`@polarsignals/sourcemap-core`](./packages/core) | Core library — debug ID generation, injection, and upload |
| [`@polarsignals/sourcemap-esbuild-plugin`](./packages/esbuild) | esbuild plugin — automatic debug ID injection and upload during build |
| [`@polarsignals/sourcemap-cli`](./packages/cli) | CLI tool — for tsc, rollup, webpack, or any build tool without a plugin |

## How It Works

1. Each `.js` + `.js.map` pair gets a deterministic **debug ID** (UUID derived from source map content)
2. The debug ID is injected into both the JavaScript file (`//# debugId=...`) and the source map (`"debugId": "..."`)
3. The source map bundle is uploaded to Polar Signals, keyed by debug ID
4. When the profiler encounters a JavaScript process, it reads the debug ID from the running code and fetches the corresponding source map for symbol resolution

## Environment Variables

All tools use the same environment variables:

```bash
export POLARSIGNALS_PROJECT_ID=<your-project-id>
export POLARSIGNALS_TOKEN=<your-token>
export POLARSIGNALS_SERVER_URL=grpc.polarsignals.com:443  # optional, this is the default
```

## Usage

### esbuild Plugin

Install:

```bash
npm install @polarsignals/sourcemap-esbuild-plugin
```

Add to your esbuild config:

```js
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

Debug ID injection and upload happen automatically at the end of each build.

### CLI

Install:

```bash
npm install @polarsignals/sourcemap-cli
```

Run after any build tool that produces `.js` + `.js.map` files:

```bash
# After tsc, rollup, webpack, etc.
tsc --project tsconfig.json

sourcemap-upload dist \
  --project-id $POLARSIGNALS_PROJECT_ID \
  --token $POLARSIGNALS_TOKEN \
  --verbose
```

Full options:

```
sourcemap-upload [options] <directory>

Required:
  <directory>                Build output directory containing .js + .js.map files
  --project-id <id>         Polar Signals project ID
  --token <token>           Authentication token

Optional:
  --server-url <url>        Debuginfo server URL (default: grpc.polarsignals.com:443)
  --verbose                 Enable verbose logging
  --dry-run                 Inject debug IDs but skip upload
  --insecure                Skip TLS verification
  --include <glob>          Glob pattern for JS files (default: **/*.js)
  --exclude <glob>          Glob pattern to exclude (default: **/node_modules/**)
```

Environment variables (`POLARSIGNALS_PROJECT_ID`, `POLARSIGNALS_TOKEN`, `POLARSIGNALS_SERVER_URL`) can be used instead of flags.

## Examples

See [`examples/sample-ts`](./examples/sample-ts) for a complete example project demonstrating both the esbuild plugin and CLI approaches.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Clean build artifacts
pnpm clean
```

## License

Apache-2.0
