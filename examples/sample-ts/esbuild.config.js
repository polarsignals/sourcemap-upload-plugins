// esbuild.config.js - Production build configuration
import esbuild from "esbuild";
import { debugIdPlugin } from "@polarsignals/sourcemap-esbuild-plugin";

const buildConfig = {
  entryPoints: ["src/server.ts"],
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: "node",
  target: "node24",
  format: "esm", // Output ES modules
  outfile: "dist/server.js",
  external: [], // Bundle all dependencies for standalone deployment

  // Source map configuration
  sourceRoot: "", // Relative source root
  sourcesContent: false, // Don't embed source content in map

  // Advanced minification options
  treeShaking: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,

  // Keep function names for better profiling
  keepNames: false, // Set to true if you want to preserve function names

  // More aggressive minification
  mangleQuoted: false, // Don't preserve quoted properties

  // Define environment
  define: {
    "process.env.NODE_ENV": '"production"',
  },

  // Banner for debugging info
  banner: {
    js: "// Built with esbuild - minified for production",
  },

  // Plugins
  plugins: [
    debugIdPlugin({
      verbose: true,
      projectID: process.env.POLARSIGNALS_PROJECT_ID,
      debuginfoServerUrl: process.env.POLARSIGNALS_SERVER_URL,
      token: process.env.POLARSIGNALS_TOKEN,
    }),
  ],
};

// Export configurations
export { buildConfig };

async function build() {
  const result = await esbuild.build(buildConfig);
  if (result.errors.length > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  build();
}
