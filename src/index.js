'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = process.argv[3];
const PLUGIN_UUID = process.argv[5];
const REGISTER_EVENT = process.argv[7];
const PLUGIN_ROOT = path.resolve(path.dirname(process.argv[1]), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'data', 'stratagems.json'), 'utf8'));
const DEFAULT_INPUT_DELAY_MS = 45;
const MIN_INPUT_DELAY_MS = 15;
const MAX_INPUT_DELAY_MS = 250;
const INPUT_DELAY_STEP_MS = 5;
const CONFIG_PATH = path.join(PLUGIN_ROOT, 'config.ini');
const HELPER_PATH = path.join(__dirname, 'bin', 'StratagemInput.exe');
const ACTION_PREFIX = `${catalog.pluginId}.`;
const INPUT_DELAY_ACTION = `${ACTION_PREFIX}input-delay`;
const stratagems = new Map(catalog.stratagems.map((item) => [item.uuid, item]));

let queue = Promise.resolve();
let inputDelayMs = readInputDelay();
const inputDelayContexts = new Set();
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

  if (message.action === INPUT_DELAY_ACTION) {
    handleInputDelayAction(message);
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
    const child = spawn(HELPER_PATH, [code, String(inputDelayMs)], {
      windowsHide: true,
      stdio: 'ignore'
    });
    child.once('error', reject);
    child.once('exit', (exitCode) => (exitCode === 0 ? resolve() : reject(new Error(`Input helper exited ${exitCode}`))));
  });
}

function handleInputDelayAction(message) {
  if (message.event === 'willAppear') {
    inputDelayContexts.add(message.context);
    showInputDelay(message.context);
    return;
  }
  if (message.event === 'willDisappear') {
    inputDelayContexts.delete(message.context);
    return;
  }
  if (message.event !== 'dialRotate') {
    return;
  }

  const ticks = Number(message.payload?.ticks);
  if (!Number.isInteger(ticks) || ticks === 0) {
    return;
  }
  inputDelayMs = clamp(inputDelayMs + ticks * INPUT_DELAY_STEP_MS, MIN_INPUT_DELAY_MS, MAX_INPUT_DELAY_MS);
  for (const context of inputDelayContexts) {
    showInputDelay(context);
  }
}

function showInputDelay(context) {
  const label = catalog.inputDelay?.displayLabel ?? 'Input delay';
  const image = createInputDelayImage(label, inputDelayMs);
  sendSocketMessage({
    event: 'setImage',
    context,
    payload: {
      target: 0,
      image
    }
  });
}

function createInputDelayImage(label, delayMs) {
  const safeLabel = escapeXml(label);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">',
    '<rect width="144" height="144" rx="18" fill="#101820"/>',
    '<rect x="10" y="10" width="124" height="124" rx="14" fill="none" stroke="#f7c948" stroke-width="3"/>',
    `<text x="72" y="48" fill="#ffffff" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="19" font-weight="600" text-anchor="middle">${safeLabel}</text>`,
    `<text x="72" y="91" fill="#f7c948" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="38" font-weight="700" text-anchor="middle">${delayMs}</text>`,
    '<text x="72" y="116" fill="#d6dde3" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="17" text-anchor="middle">ms</text>',
    '</svg>'
  ].join('');
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

function showFeedback(event, context) {
  sendSocketMessage({ event, context });
}

function sendSocketMessage(message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function readInputDelay() {
  try {
    const ini = fs.readFileSync(CONFIG_PATH, 'utf8');
    let section = '';
    for (const rawLine of ini.split(/\r?\n/u)) {
      const line = rawLine.replace(/^\uFEFF/u, '').trim();
      if (!line || line.startsWith(';') || line.startsWith('#')) continue;
      const sectionMatch = line.match(/^\[([^\]]+)\]$/u);
      if (sectionMatch) {
        section = sectionMatch[1].trim().toLowerCase();
        continue;
      }
      if (section !== 'input') continue;
      const propertyMatch = line.match(/^([^=]+)=(.*)$/u);
      if (!propertyMatch || propertyMatch[1].trim().toLowerCase() !== 'keyintervalms') continue;
      const configured = Number(propertyMatch[2].split(/[;#]/u, 1)[0].trim());
      if (Number.isFinite(configured)) {
        return clamp(Math.round(configured), MIN_INPUT_DELAY_MS, MAX_INPUT_DELAY_MS);
      }
    }
  } catch {
    // Missing or unreadable configuration keeps the historical hard-coded value.
  }
  return DEFAULT_INPUT_DELAY_MS;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
