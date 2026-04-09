# @polarsignals/sourcemap-cli

CLI tool for injecting debug IDs into built JavaScript files and uploading source maps to [Polar Signals](https://polarsignals.com). Works with any build tool that produces `.js` + `.js.map` files — `tsc`, rollup, webpack, swc, etc.

## Installation

```bash
npm install @polarsignals/sourcemap-cli
```

## Usage

Run after your build step:

```bash
tsc --project tsconfig.json

sourcemap-upload dist \
  --project-id $POLARSIGNALS_PROJECT_ID \
  --token $POLARSIGNALS_TOKEN \
  --verbose
```

Or use it via `npx` without installing:

```bash
npx @polarsignals/sourcemap-cli dist \
  --project-id $POLARSIGNALS_PROJECT_ID \
  --token $POLARSIGNALS_TOKEN
```

## Options

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

## Environment Variables

Flags can be replaced with environment variables:

| Variable | Flag |
|----------|------|
| `POLARSIGNALS_PROJECT_ID` | `--project-id` |
| `POLARSIGNALS_TOKEN` | `--token` |
| `POLARSIGNALS_SERVER_URL` | `--server-url` |

## How It Works

1. Scans the directory for `.js` + `.js.map` pairs
2. Generates a deterministic debug ID (UUID) from each source map's content
3. Injects the debug ID into both the JavaScript (`//# debugId=...`) and source map (`"debugId": "..."`)
4. Uploads the source map bundle to Polar Signals, keyed by debug ID

## Using esbuild?

If your build tool is esbuild, use [`@polarsignals/sourcemap-esbuild-plugin`](https://www.npmjs.com/package/@polarsignals/sourcemap-esbuild-plugin) instead — it handles everything automatically as part of the build.

## License

Apache-2.0
