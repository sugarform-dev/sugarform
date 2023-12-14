import { consola } from 'consola';
import { join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { transform, minify } from '@swc/core';
import { build } from 'esbuild';
import { execa } from 'execa';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import packageJson from './package.json' assert { type: 'json' };
import { transfer } from 'multi-stage-sourcemap';
import { createCompilerHost, createIncrementalCompilerHost, createProgram } from 'typescript';

const entry = './lib.ts';

consola.start('Building @sugarform/core...');

consola.info(`entrypoint: ${entry}`);

await rm('./dist', { recursive: true, force: true });
consola.success('Cleaned up dist folder.');

await mkdir('./dist', { recursive: true });
consola.success('Created dist folder.');

consola.log('');
const bundled = bundle();
await Promise.all([bundled, pipeline('esm'), pipeline('cjs'), types()]);
consola.log('');
consola.success('All tasks completed.');
consola.log('');

async function bundle() {
  consola.start(`Bundling...`);
  const { outputFiles } = await build({
    entryPoints: [entry],
    sourcemap: 'external',
    target: 'esnext',
    bundle: true,
    write: false,
    platform: 'neutral',
    outfile: './index.ts',
    jsx: 'preserve',
    plugins: [
      nodeExternalsPlugin({
        devDependencies: false,
      }),
    ],
  });
  const sourcemap = outputFiles.find((v) => v.path.endsWith('index.ts.map'))
    ?.text;
  const source = outputFiles.find((v) => v.path.endsWith('index.ts'))?.text;

  if (sourcemap === undefined) {
    consola.error('Build result of esbuild did not contain sourcemap!');
    process.exit(1);
  }
  if (source === undefined) {
    consola.error('Build result of esbuild did not contain source!');
    process.exit(1);
  }
  consola.success(
    `Bundled by esbuild! (${toKiloBytes(getStringBytes(source))})`
  );
  return { sourcemap, source };
}

async function types() {
  const output = join(packageJson.exports['.'].types);
  consola.start('Building types...');

  const createdFiles: Record<string, string> = {};
  
  await writeFile('./dist/index.ts', (await bundled).source);
  const options = {
    declaration: true,
    declarationMap: true,
    emitDeclarationOnly: true,
  };
  const host = createIncrementalCompilerHost(options);
  host.writeFile = (fileName: string, contents: string) => createdFiles[fileName] = contents;

  const program = createProgram(['./dist/index.ts'], options, host);
  program.emit();

  console.log(createdFiles);
  consola.success(`Done! (${output})`);
}

async function pipeline(format: 'esm' | 'cjs') {
  const code = await bundled;

  consola.start(`[${format}] Building...`);
  const output = join(
    format === 'esm'
      ? packageJson.exports['.'].import
      : packageJson.exports['.'].require
  );

  const transformed = await transform(code.source, {
    sourceMaps: true,
    isModule: true,
    minify: true,
    module: {
      type: format === 'esm' ? 'es6' : 'commonjs',
    },
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: true,
      },
      target: 'es2017',
      loose: false,
    },
  });

  const transform_map = transformed.map;
  if (transform_map === undefined) {
    consola.error(
      `[${format}] Transform result of SWC did not contain source!`
    );
    process.exit(1);
  }

  const minified = await minify(transformed.code, {
    compress: {},
    sourceMap: true,
    mangle: false,
    module: true,
  });

  const minify_map = minified.map;
  if (minify_map === undefined) {
    consola.error(`[${format}] Minify result of SWC did not contain source!`);
    process.exit(1);
  }

  const size = {
    unminified: getStringBytes(transformed.code),
    minified: getStringBytes(minified.code),
  };

  consola.info(
    `[${format}] SWC minified. (${toKiloBytes(
      size.unminified
    )} -> ${toKiloBytes(size.minified)}, -${Math.round(
      (1 - size.minified / size.unminified) * 100
    )}%)`
  );

  await writeFile(output, minified.code);
  consola.success(`[${format}] Done! (${output})`);

  consola.start(`[${format}] Merging sourcemaps...`);
  const swc_map = transfer({
    fromSourceMap: minify_map,
    toSourceMap: transform_map,
  });
  const sourcemap = transfer({
    fromSourceMap: swc_map,
    toSourceMap: (await bundled).sourcemap,
  });
  const sourcemap_output = `${output}.map`;
  await writeFile(sourcemap_output, sourcemap);
  consola.success(`[${format}] Done! (${sourcemap_output})`);
}

function getStringBytes(str: string) {
  return Buffer.byteLength(str, 'utf-8');
}
function toKiloBytes(bytes: number) {
  return `${Math.round(bytes / 10) / 100}kB`;
}
