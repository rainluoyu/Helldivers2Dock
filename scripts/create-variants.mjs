import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const editions = [
  {
    localePath: path.resolve('i18n/en.json'),
    directory: path.resolve('build/com.n4pro.helldivers2dock.sdPlugin')
  },
  {
    localePath: path.resolve('i18n/zh-CN.json'),
    directory: path.resolve('build/com.n4pro.helldivers2dock.zh-cn.sdPlugin')
  }
];
const requestedLocale = getOption('--locale') ?? 'all';
const baseCatalog = JSON.parse(await readFile(path.resolve('data/stratagems.json'), 'utf8'));
const sourceSlugs = new Set(baseCatalog.stratagems.map((item) => item.slug));

const prepared = [];
for (const edition of editions) {
  const locale = JSON.parse(await readFile(edition.localePath, 'utf8'));
  if (requestedLocale !== 'all' && requestedLocale !== locale.locale) continue;
  validateLocale(locale, sourceSlugs, edition.localePath);

  await Promise.all([
    mkdir(path.join(edition.directory, 'data'), { recursive: true }),
    cp(path.resolve('assets/images'), path.join(edition.directory, 'images'), { recursive: true, force: true }),
    cp(path.resolve('assets/static'), path.join(edition.directory, 'static'), { recursive: true, force: true }),
    cp(path.resolve('config.ini'), path.join(edition.directory, 'config.ini'), { force: true })
  ]);

  const catalog = structuredClone(baseCatalog);
  catalog.pluginId = locale.pluginId;
  catalog.language = locale.locale;
  catalog.keyInterval = locale.keyInterval;
  for (const item of catalog.stratagems) {
    item.englishName = item.name;
    item.name = locale.stratagems[item.slug] ?? item.name;
    item.category = locale.categories[item.category] ?? item.category;
    item.uuid = `${locale.pluginId}.${item.slug}`;
    if (locale.locale === 'en') delete item.englishName;
  }
  await writeJson(path.join(edition.directory, 'data/stratagems.json'), catalog);

  const version = process.env.PLUGIN_VERSION ?? locale.version;
  const manifest = createManifest(locale, catalog, version);
  const streamDockLocale = createStreamDockLocale(manifest, catalog);
  await Promise.all([
    writeJson(path.join(edition.directory, 'manifest.json'), manifest),
    writeJson(path.join(edition.directory, 'en.json'), streamDockLocale),
    writeJson(path.join(edition.directory, 'zh_CN.json'), streamDockLocale)
  ]);
  prepared.push(`${locale.locale} ${version}`);
}

if (!prepared.length) {
  throw new Error(`Unknown locale '${requestedLocale}'. Expected en, zh-CN, or all.`);
}
console.log(`Prepared ${prepared.join(', ')} with ${baseCatalog.stratagems.length} actions per edition.`);

function createManifest(locale, catalog, version) {
  return {
    Actions: [
      ...catalog.stratagems.map((item) => ({
        Icon: item.icon,
        Name: item.name,
        DisableAutomaticStates: true,
        States: [{ Image: item.icon, TitleAlignment: 'bottom', FontSize: '8' }],
        Controllers: ['Keypad'],
        UserTitleEnabled: true,
        SupportedInMultiActions: true,
        Tooltip: `${item.name} — ${item.arrows}`,
        UUID: item.uuid
      })),
      {
        Icon: 'static/plugin-icon.png',
         Name: locale.keyInterval.name,
        DisableAutomaticStates: true,
        States: [{
          Image: 'static/plugin-icon.png',
          TitleAlignment: 'center',
          FontSize: '11',
          ShowTitle: false
        }],
        Controllers: ['Knob'],
        UserTitleEnabled: false,
        SupportedInMultiActions: false,
         Tooltip: locale.keyInterval.tooltip,
         UUID: `${locale.pluginId}.key-interval`
      }
    ],
    UUID: locale.pluginId,
    SDKVersion: 1,
    Author: 'N4Pro Community',
    Name: locale.plugin.name,
    Icon: 'static/plugin-icon.png',
    CodePathWin: 'plugin/index.js',
    Description: locale.plugin.description,
    Category: locale.plugin.category,
    CategoryIcon: 'static/plugin-icon.png',
    Version: version,
    URL: catalog.source,
    OS: [{ Platform: 'windows', MinimumVersion: '10' }],
    Software: { MinimumVersion: '3.10.188.226' },
    Nodejs: { Version: '20' }
  };
}

function createStreamDockLocale(manifest, catalog) {
  const localized = {
    Name: manifest.Name,
    Description: manifest.Description,
    Category: manifest.Category
  };
  for (const item of catalog.stratagems) {
    localized[item.uuid] = { Name: item.name, Tooltip: `${item.name} — ${item.arrows}` };
  }
  localized[`${catalog.pluginId}.key-interval`] = {
    Name: catalog.keyInterval.name,
    Tooltip: catalog.keyInterval.tooltip
  };
  return localized;
}

function validateLocale(locale, slugs, file) {
  for (const field of ['locale', 'pluginId', 'version', 'plugin', 'keyInterval', 'categories', 'stratagems']) {
    if (locale[field] === undefined) throw new Error(`${file} is missing '${field}'.`);
  }
  const translated = Object.keys(locale.stratagems);
  const missing = [...slugs].filter((slug) => !locale.stratagems[slug]);
  const extra = translated.filter((slug) => !slugs.has(slug));
  if (missing.length || extra.length) {
    throw new Error(`${file} does not match the catalog. Missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`);
  }
}

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
