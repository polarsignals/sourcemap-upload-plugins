import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const external = [
  // Node.js built-ins
  'crypto',
  'fs',
  'path',
  'os',
  'node:util',
  'node:process',

  // External dependencies that should not be bundled
  '@polarsignals/sourcemap-core',
  '@grpc/grpc-js',
  '@protobuf-ts/grpc-transport',
];

export default {
  input: 'src/cli.ts',
  external,
  plugins: [
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: { noEmit: false },
      declaration: false,
      declarationMap: false,
    }),
  ],
  output: {
    file: 'dist/cli.js',
    format: 'es',
    sourcemap: false,
    banner: '#!/usr/bin/env node',
    inlineDynamicImports: true,
  },
  onwarn: (warning, warn) => {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};
