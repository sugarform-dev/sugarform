import { consola } from 'consola';
import { basename, dirname, join } from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { transformFile, minify } from '@swc/core';
import { execa } from 'execa';
import tsc from 'tsc-prog';
import packageJson from './package.json' assert { type: 'json' };


const entry = './lib.ts';

consola.start('Building @sugarform/core...');

consola.info(`entrypoint: ${entry}`);

await rm('./dist', { recursive: true, force: true });
consola.success('Cleaned up dist folder.');

await mkdir('./dist', { recursive: true });
consola.success('Created dist folder.');

consola.log('');
await Promise.all([pipeline('es'), pipeline('cjs'), types()]);
consola.log('');


async function types() {
  const output = join(packageJson.exports['.'].types);
  consola.start('Building types...');
  await execa('dts-bundle-generator', ['-o', output, entry]).pipeStdout(process.stdout).pipeStderr(process.stderr);
  consola.success(`Done! (${output})`);
}

async function pipeline(format: 'es' | 'cjs') {
  consola.start(`Building ${format}...`);
  const output = join(format === 'es' ? packageJson.exports['.'].import : packageJson.exports['.'].require);

  const transformed = await transformFile(entry, {
    sourceMaps: false,
    isModule: true,
    minify: true,
    module: {
      type: format === 'es' ? 'es6' : 'commonjs',
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

  const minified = await minify(transformed.code, {
    compress: {},
    mangle: false,
    module: true,
  });

  const size = {
    uncompressed: getStringBytes(transformed.code),
    compressed: getStringBytes(minified.code),
  };

  consola.info(`[${format}] SWC minified. (${toKiloBytes(size.uncompressed)} -> ${toKiloBytes(size.compressed)}, -${Math.round((1 - size.compressed / size.uncompressed) * 100)}%)`);

  await writeFile(output, minified.code);
  consola.success(`Done! (${output})`);
}

function getStringBytes(str: string) {
  return Buffer.byteLength(str, 'utf-8');
}
function toKiloBytes(bytes: number) {
  return `${Math.round(bytes * 100) / 100}kB`;
}
