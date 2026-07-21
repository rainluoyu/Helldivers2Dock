'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stratagems.json'), 'utf8'));

const PORT = process.argv[3];
const PLUGIN_UUID = process.argv[5];
const REGISTER_EVENT = process.argv[7];
const INPUT_DELAY_MS = 45;
const HELPER_PATH = path.join(__dirname, 'bin', 'StratagemInput.exe');
const ACTION_PREFIX = `${catalog.pluginId}.`;
const stratagems = new Map(catalog.stratagems.map((item) => [item.uuid, item]));

let queue = Promise.resolve();
const socket = new WebSocket(`ws://127.0.0.1:${PORT}`);

socket.on('open', () => {
  socket.send(JSON.stringify({ uuid: PLUGIN_UUID, event: REGISTER_EVENT }));
});

socket.on('message', (raw) => {
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }

  if (message.event !== 'keyDown' || !message.action?.startsWith(ACTION_PREFIX)) {
    return;
  }

  const stratagem = stratagems.get(message.action);
  if (!stratagem) {
    showFeedback('showAlert', message.context);
    return;
  }

  queue = queue
    .then(() => runMacro(stratagem.code))
    .then(() => showFeedback('showOk', message.context))
    .catch(() => showFeedback('showAlert', message.context));
});

socket.on('error', () => {});
socket.on('close', () => process.exit(0));

function runMacro(code) {
  return new Promise((resolve, reject) => {
    const child = spawn(HELPER_PATH, [code, String(INPUT_DELAY_MS)], {
      windowsHide: true,
      stdio: 'ignore'
    });
    child.once('error', reject);
    child.once('exit', (exitCode) => (exitCode === 0 ? resolve() : reject(new Error(`Input helper exited ${exitCode}`))));
  });
}

function showFeedback(event, context) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, context }));
  }
}
