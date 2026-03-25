import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const external = [
  // Node.js built-ins
  'crypto',
  'fs',
  'path',
  'os',

  // External dependencies that should not be bundled
  'esbuild',
  '@polarsignals/sourcemap-core',
  '@grpc/grpc-js',
  '@protobuf-ts/grpc-transport',
];

export default [
  // ESM build
  {
    input: 'src/index.ts',
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
      file: 'dist/esm/index.mjs',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    onwarn: (warning, warn) => {
      if (warning.code === 'CIRCULAR_DEPENDENCY') return;
      warn(warning);
    },
  },

  // CommonJS build
  {
    input: 'src/index.ts',
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
      file: 'dist/cjs/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true,
    },
    onwarn: (warning, warn) => {
      if (warning.code === 'CIRCULAR_DEPENDENCY') return;
      warn(warning);
    },
  },
];
