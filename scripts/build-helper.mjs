import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('build/com.n4pro.helldivers2dock.sdPlugin/plugin/bin/StratagemInput.exe');
await mkdir(path.dirname(output), { recursive: true });

const result = spawnSync('g++', [
  '-std=c++17',
  '-O2',
  '-s',
  '-static',
  path.resolve('native/StratagemInput.cpp'),
  '-o',
  output
], { stdio: 'inherit' });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
