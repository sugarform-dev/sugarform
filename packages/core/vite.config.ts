import { resolve } from 'path';
import terser from "@rollup/plugin-terser";
import reactPlugin from '@vitejs/plugin-react-swc';
import outputSize from 'rollup-plugin-output-size';
import packageJson from "./package.json" assert { type: "json" };
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    reactPlugin(),
    terser({
      compress: {},
      mangle: {},
    }),
    outputSize(),
  ],
  build: {
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.ts'),
      output: [
        {
          file: packageJson.exports['.'].import,
          format: "es",
          sourcemap: true,
        },
        {
          file: packageJson.exports['.'].require,
          format: "cjs",
          sourcemap: true,
        },
      ],
      external: ['react'],
      output: {
        globals: {
          react: 'React',
        },
      },
    },
  },
})
