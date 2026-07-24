import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const variants = [
  {
    locale: 'en',
    entry: path.resolve('build/com.n4pro.helldivers2dock.sdPlugin/plugin/index.js'),
    inputDelayAction: 'com.n4pro.helldivers2dock.input-delay'
  },
  {
    locale: 'zh-CN',
    entry: path.resolve('build/com.n4pro.helldivers2dock.zh-cn.sdPlugin/plugin/index.js'),
    inputDelayAction: 'com.n4pro.helldivers2dock.zh-cn.input-delay'
  }
];
const requestedLocale = getOption('--locale') ?? 'all';
const selected = variants.filter((variant) => requestedLocale === 'all' || variant.locale === requestedLocale);
if (!selected.length) throw new Error(`Unknown locale '${requestedLocale}'. Expected en, zh-CN, or all.`);

for (const [index, variant] of selected.entries()) {
  await testRegistration(variant, `registration-test-${index}`);
}
console.log(`${selected.map((variant) => variant.locale).join(', ')} registration and input-delay knob tests passed.`);

async function testRegistration(variant, uuid) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();
  const child = spawn(process.execPath, [
    variant.entry,
    '-port', String(port),
    '-pluginUUID', uuid,
    '-registerEvent', 'registerPlugin',
    '-info', JSON.stringify({ application: { language: 'en' } })
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const childExit = new Promise((resolve) => child.once('exit', resolve));
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

  const context = `${variant.locale}-input-delay`;
  const configuredDelay = readConfiguredDelay(variant.entry);
  const firstImage = receiveJson(registration.socket);
  registration.socket.send(JSON.stringify({
    action: variant.inputDelayAction,
    event: 'willAppear',
    context,
    payload: { controller: 'Knob' }
  }));
  assertInputDelayImage(await firstImage, context, configuredDelay);

  const rotatedImage = receiveJson(registration.socket);
  registration.socket.send(JSON.stringify({
    action: variant.inputDelayAction,
    event: 'dialRotate',
    context,
    payload: { controller: 'Knob', ticks: 2, pressed: false }
  }));
  assertInputDelayImage(await rotatedImage, context, Math.min(250, configuredDelay + 10));

  registration.socket.close();
  await new Promise((resolve) => server.close(resolve));
  await childExit;
  clearTimeout(timeout);
}

function readConfiguredDelay(entry) {
  const configPath = path.resolve(path.dirname(entry), '..', 'config.ini');
  const ini = readFileSync(configPath, 'utf8');
  const value = Number(ini.match(/^\s*KeyIntervalMs\s*=\s*(\d+)/imu)?.[1] ?? 45);
  return Math.min(250, Math.max(15, Math.round(value)));
}

function receiveJson(socket) {
  return new Promise((resolve, reject) => {
    socket.once('message', (raw) => {
      try { resolve(JSON.parse(raw.toString())); }
      catch (error) { reject(error); }
    });
  });
}

function assertInputDelayImage(message, context, expectedDelay) {
  if (message.event !== 'setImage' || message.context !== context || message.payload?.target !== 0) {
    throw new Error(`Unexpected knob image payload: ${JSON.stringify(message)}`);
  }
  const prefix = 'data:image/svg+xml;base64,';
  if (!message.payload.image?.startsWith(prefix)) {
    throw new Error('Input-delay knob did not receive a Base64 SVG image');
  }
  const svg = Buffer.from(message.payload.image.slice(prefix.length), 'base64').toString('utf8');
  if (!svg.includes(`>${expectedDelay}</text>`) || !svg.includes('>ms</text>')) {
    throw new Error(`Input-delay image does not show ${expectedDelay} ms`);
  }
}

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}
