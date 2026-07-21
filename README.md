# Helldivers2Dock

[English](README.md) | [简体中文](README.zh-CN.md)

Helldivers2Dock is a Windows Stream Dock plugin that provides one-button macros for every catalogued *Helldivers 2* stratagem, including support weapons, backpacks, sentries, vehicles, reinforcement, resupply, and mission-only stratagems.

The implementation targets the Mirabox/Ajazz Stream Dock Node.js plugin runtime.

## Features

- 108 independently draggable stratagem actions.
- English and Simplified Chinese editions with separate plugin IDs, packages, and releases.
- Default `Left Ctrl` + `W/A/S/D` stratagem input through a small Win32 `SendInput` helper.

## Editions

| Edition | Plugin directory | Release tag |
|---|---|---|
| English | `com.n4pro.helldivers2dock.sdPlugin` | `en-vX.Y.Z` |
| Simplified Chinese | `com.n4pro.helldivers2dock.zh-cn.sdPlugin` | `zh-cn-vX.Y.Z` |

Both editions may be installed at the same time. They use different plugin and action UUIDs but share the same icons, sequences, and runtime.

## Requirements

- Windows 10 or later.
- Stream Dock 3.10.188.226 or later with the Node 20 plugin runtime.
- Default in-game stratagem controls: hold left `Ctrl`, then enter directions using `W/A/S/D`.
- Stream Dock and the game must run at the same Windows integrity level.

## Installation

1. Download the release archive for the desired language.
2. Extract its `.sdPlugin` directory into `%APPDATA%\HotSpot\StreamDock\plugins\`.
3. Restart Stream Dock.
4. Drag actions from **Helldivers 2 Dock (English)** or **绝地潜兵 2 Dock（简体中文）** onto the device.

Release archives contain only installable runtime files. Source code, build scripts, private profiles, original wiki downloads, and the other language edition are not included in an edition package.

## Build from source

Install Node.js 20+, npm, a MinGW-w64 `g++`, and PowerShell. Then run:

```powershell
npm ci
npm run build
npm run package
```

Language-specific commands are available:

```powershell
npm run build:en
npm run package:en

npm run build:zh-CN
npm run package:zh-CN
```

Packages are written to `dist/`. The packaging script uses an explicit runtime allowlist and rejects source files, `.SDProfile` files, original wiki downloads, and other non-runtime content.

To refresh the catalog and icons from the wiki, install ImageMagick and run `npm run refresh-data` before rebuilding.

## Internationalization

All edition metadata and localized labels live in [`i18n/`](i18n):

- `i18n/en.json` explicitly lists English metadata, categories, and all 108 source labels so contributors can copy it when starting a new locale.
- `i18n/zh-CN.json` supplies Simplified Chinese metadata, categories, and all 108 label resolutions.

`scripts/create-variants.mjs` validates locale coverage and generates manifests, action UUIDs, catalogs, and Stream Dock locale files. Add a new locale by adding one i18n file and registering its output directory in the build scripts; runtime macro logic does not need to be duplicated.

## Releases

GitHub Actions builds and publishes each language independently:

- Push `en-v1.2.0` to publish only `Helldivers2Dock-en-1.2.0.zip`.
- Push `zh-cn-v1.2.0` to publish only `Helldivers2Dock-zh-CN-1.2.0.zip`.

Each release workflow derives the manifest and archive version from its tag, performs a clean build, validates plugin registration, checks archive contents, and uploads exactly one language package.

## Project layout

- `src/` — shared Node.js Stream Dock runtime.
- `native/` — Win32 input helper source.
- `scripts/` — data synchronization, i18n generation, validation, and packaging.
- `i18n/` — edition metadata and translations.
- `assets/` — tracked runtime icons, original wiki-source icons, and plugin icon.
- `data/stratagems.json` — tracked canonical stratagem catalog.
- `build/*.sdPlugin/` — generated installable plugin trees; ignored by Git.
- `.github/workflows/` — CI and independent language release workflows.

## Copyright and attribution

The MIT license applies to the original source code only. *Helldivers 2* names, trademarks, and game-derived stratagem icons are not licensed under MIT and remain the property of their respective rights holders. They are included for identification in a non-commercial fan project; no affiliation or endorsement is implied.

Read [ASSET_LICENSE.md](ASSET_LICENSE.md) before redistributing a fork or release. It also records the wiki, SDK, localization, and structural references used by the project.
