import { spawn } from 'node:child_process';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const variants = [
  { locale: 'en', entry: path.resolve('build/com.n4pro.helldivers2dock.sdPlugin/plugin/index.js') },
  { locale: 'zh-CN', entry: path.resolve('build/com.n4pro.helldivers2dock.zh-cn.sdPlugin/plugin/index.js') }
];
const requestedLocale = getOption('--locale') ?? 'all';
const selected = variants.filter((variant) => requestedLocale === 'all' || variant.locale === requestedLocale);
if (!selected.length) throw new Error(`Unknown locale '${requestedLocale}'. Expected en, zh-CN, or all.`);

for (const [index, variant] of selected.entries()) {
  await testRegistration(variant.entry, `registration-test-${index}`);
}
console.log(`${selected.map((variant) => variant.locale).join(', ')} WebSocket registration handshake(s) passed.`);

async function testRegistration(pluginEntry, uuid) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();
  const child = spawn(process.execPath, [
    pluginEntry,
    '-port', String(port),
    '-pluginUUID', uuid,
    '-registerEvent', 'registerPlugin',
    '-info', JSON.stringify({ application: { language: 'en' } })
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  const timeout = setTimeout(() => {
    child.kill();
    server.close();
  }, 5000);
  const registration = await new Promise((resolve, reject) => {
    server.once('connection', (socket) => {
      socket.once('message', (raw) => {
        try { resolve({ socket, message: JSON.parse(raw.toString()) }); }
        catch (error) { reject(error); }
      });
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Plugin exited before registration with code ${code}: ${stderr}`)));
  });
  if (registration.message.uuid !== uuid || registration.message.event !== 'registerPlugin') {
    throw new Error(`Unexpected registration payload: ${JSON.stringify(registration.message)}`);
  }
  registration.socket.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => child.once('exit', resolve));
  clearTimeout(timeout);
}

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}
