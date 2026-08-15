import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const variants = [
  { locale: 'en', directory: 'build/com.n4pro.helldivers2dock.sdPlugin', i18n: 'i18n/en.json' },
  { locale: 'zh-CN', directory: 'build/com.n4pro.helldivers2dock.zh-cn.sdPlugin', i18n: 'i18n/zh-CN.json' }
];
const requestedLocale = getOption('--locale') ?? 'all';
const selected = variants.filter((variant) => requestedLocale === 'all' || variant.locale === requestedLocale);
if (!selected.length) throw new Error(`Unknown locale '${requestedLocale}'. Expected en, zh-CN, or all.`);

const errors = [];
const catalogs = [];
for (const variant of selected) {
  const pluginDir = path.resolve(variant.directory);
  const locale = JSON.parse(await readFile(path.resolve(variant.i18n), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(pluginDir, 'manifest.json'), 'utf8'));
  const catalog = JSON.parse(await readFile(path.join(pluginDir, 'data/stratagems.json'), 'utf8'));
  const enLocale = JSON.parse(await readFile(path.join(pluginDir, 'en.json'), 'utf8'));
  const zhLocale = JSON.parse(await readFile(path.join(pluginDir, 'zh_CN.json'), 'utf8'));
  catalogs.push(catalog);

  if (catalog.pluginId !== locale.pluginId) errors.push(`${variant.locale}: catalog pluginId is ${catalog.pluginId}`);
  if (catalog.language !== variant.locale) errors.push(`${variant.locale}: catalog language is ${catalog.language}`);
  if (manifest.UUID !== locale.pluginId) errors.push(`${variant.locale}: manifest UUID is ${manifest.UUID}`);
  if (manifest.Name !== locale.plugin.name) errors.push(`${variant.locale}: manifest name is ${manifest.Name}`);
  if (manifest.Version !== (process.env.PLUGIN_VERSION ?? locale.version)) errors.push(`${variant.locale}: unexpected version ${manifest.Version}`);
  if (enLocale.Name !== locale.plugin.name || zhLocale.Name !== locale.plugin.name) {
    errors.push(`${variant.locale}: Stream Dock locale files do not preserve the edition language`);
  }
  if (manifest.Actions.length !== catalog.stratagems.length + 2) {
     errors.push(`${variant.locale}: manifest has ${manifest.Actions.length} actions; expected ${catalog.stratagems.length} stratagems plus two timing knobs`);
  }
  if (catalog.stratagems.length < 100) errors.push(`${variant.locale}: catalog only has ${catalog.stratagems.length} items`);

  const actionUuids = new Set(manifest.Actions.map((action) => action.UUID));
  if (actionUuids.size !== manifest.Actions.length) errors.push(`${variant.locale}: duplicate action UUIDs`);
   for (const actionName of ['input-delay', 'key-interval']) {
    const timingAction = manifest.Actions.find((action) => action.UUID === `${locale.pluginId}.${actionName}`);
    if (!timingAction) errors.push(`${variant.locale}: ${actionName} knob action is missing from manifest`);
    else if (timingAction.Controllers.length !== 1 || timingAction.Controllers[0] !== 'Knob') {
      errors.push(`${variant.locale}: ${actionName} action must target the Mirabox Knob controller`);
    }
   }

  for (const item of catalog.stratagems) {
    if (!/^[UDLR]+$/.test(item.code)) errors.push(`${variant.locale}: ${item.name} has invalid code ${item.code}`);
    if (item.uuid !== `${locale.pluginId}.${item.slug}`) errors.push(`${variant.locale}: ${item.name} has an incorrect UUID`);
    if (!actionUuids.has(item.uuid)) errors.push(`${variant.locale}: ${item.name} is missing from manifest`);
    if (variant.locale === 'en' && /[\u3400-\u9fff]/u.test(item.name)) errors.push(`English action contains Chinese text: ${item.name}`);
    if (variant.locale !== 'en' && item.name !== locale.stratagems[item.slug]) {
      errors.push(`${variant.locale}: ${item.slug} does not match its i18n value`);
    }
    for (const relative of [item.icon, item.originalIcon]) {
      try {
        const details = await stat(path.join(pluginDir, relative));
        if (details.size === 0) errors.push(`${variant.locale}: ${item.name} has an empty ${relative}`);
      } catch {
        errors.push(`${variant.locale}: ${item.name} is missing ${relative}`);
      }
    }
  }

  for (const relative of [
    'config.ini',
    'plugin/index.js',
    'plugin/bin/StratagemInput.exe',
    'static/plugin-icon.png'
  ]) {
    try { await stat(path.join(pluginDir, relative)); }
    catch { errors.push(`${variant.locale}: plugin is missing ${relative}`); }
  }
  for (const shadowedRootFile of ['plugin/config.ini', 'plugin/stratagems.json']) {
    try {
      await stat(path.join(pluginDir, shadowedRootFile));
      errors.push(`${variant.locale}: runtime contains a stale shadow copy at ${shadowedRootFile}`);
    } catch {}
  }

  const nodeCheck = spawnSync(process.execPath, ['--check', path.join(pluginDir, 'plugin/index.js')], { encoding: 'utf8' });
  if (nodeCheck.status !== 0) errors.push(`${variant.locale}: bundled Node plugin failed syntax check: ${nodeCheck.stderr}`);
  const helperCheck = spawnSync(path.join(pluginDir, 'plugin/bin/StratagemInput.exe'), ['--self-test'], { encoding: 'utf8' });
  if (helperCheck.status !== 0) errors.push(`${variant.locale}: input helper self-test failed with ${helperCheck.status}`);
}

if (catalogs.length === 2) {
  const [english, chinese] = catalogs;
  for (const englishItem of english.stratagems) {
    const chineseItem = chinese.stratagems.find((item) => item.slug === englishItem.slug);
    if (!chineseItem) errors.push(`Chinese catalog is missing ${englishItem.slug}`);
    else if (chineseItem.code !== englishItem.code || chineseItem.icon !== englishItem.icon) {
      errors.push(`Edition mismatch for ${englishItem.slug}`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`Validated ${selected.map((variant) => variant.locale).join(', ')}: ${catalogs[0].stratagems.length} actions, assets, JavaScript, helper, i18n, and legal files.`);

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}
