import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('build/com.n4pro.helldivers2dock.sdPlugin', 'plugin');
const destination = path.resolve('build/com.n4pro.helldivers2dock.zh-cn.sdPlugin', 'plugin');
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
console.log('Copied the shared Node runtime and input helper into the Simplified Chinese edition.');
