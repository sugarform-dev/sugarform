import { resolve, basename } from 'path';
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
    lib: {
      entry: resolve(__dirname, 'lib.ts'),
      name: '@sugarform/core',
      formats: ['cjs', 'es'],
      fileName: format => {
        if (format === 'cjs') return basename(packageJson.exports['.'].require);
        if (format === 'es') return basename(packageJson.exports['.'].import);
        throw new Error();
      }
    },
    rollupOptions: {
      external: ['react'],
      output: {
        globals: {
          react: 'React',
        },
      },
    },
  },
})
