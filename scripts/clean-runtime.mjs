import { rm } from 'node:fs/promises';
import path from 'node:path';

for (const directory of [
  'build/com.n4pro.helldivers2dock.sdPlugin',
  'build/com.n4pro.helldivers2dock.zh-cn.sdPlugin'
]) {
  await rm(path.resolve(directory, 'plugin/package.json'), { force: true });
}
