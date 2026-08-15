# Helldivers2Dock

[English](README.md) | [简体中文](README.zh-CN.md)

Helldivers2Dock is a Windows Stream Dock plugin designed specifically for Mirabox devices. It provides one-button macros for every catalogued *Helldivers 2* stratagem, including support weapons, backpacks, sentries, vehicles, reinforcement, resupply, and mission-only stratagems.

The implementation targets Mirabox Stream Dock hardware and the Mirabox Stream Dock Node.js plugin runtime.

## Features

- 108 independently draggable stratagem actions.
- Separate pre-input delay (`45 ms`) and key interval (`8 ms`) configuration in the plugin-root `config.ini`. The pre-input delay is also retained between directional inputs.
- A Mirabox knob action that temporarily adjusts the key interval from `1–250 ms` in `1 ms` steps and renders the label and current value as an image on the knob display.
- English and Simplified Chinese editions with separate plugin IDs and packages, published together in one release.
- Default `Left Ctrl` + `W/A/S/D` stratagem input through a small Win32 `SendInput` helper.

## Supported devices

This plugin is designed for Mirabox Stream Dock devices used with the official Stream Dock software. Key actions require a Mirabox device with programmable keys; temporary key-interval control requires a model with a knob and knob display. Devices or software from other vendors may implement a compatible protocol, but they are not the primary target and are not guaranteed to work.

## Editions

| Edition | Plugin directory | Release tag |
|---|---|---|
| English | `com.n4pro.helldivers2dock.sdPlugin` | `vX.Y.Z` |
| Simplified Chinese | `com.n4pro.helldivers2dock.zh-cn.sdPlugin` | `vX.Y.Z` |

Both packages are attached to the same version release and may be installed at the same time. They use different plugin and action UUIDs but share the same icons, sequences, and runtime.

## Requirements

- Windows 10 or later.
- A Mirabox Stream Dock device running Stream Dock 3.10.188.226 or later with the Node 20 plugin runtime.
- Default in-game stratagem controls: hold left `Ctrl`, then enter directions using `W/A/S/D`.
- Stream Dock and the game must run at the same Windows integrity level.

## Installation

1. Open the desired version release and download its English or Simplified Chinese archive.
2. Extract its `.sdPlugin` directory into `%APPDATA%\HotSpot\StreamDock\plugins\`.
3. Restart Stream Dock.
4. Drag actions from **Helldivers 2 Dock (English)** or **绝地潜兵 2 Dock（简体中文）** onto the device.

Release archives contain only installable runtime files. Source code, build scripts, private profiles, original wiki downloads, and the other language edition are not included in an edition package.

### Adjusting the input delay

For a permanent adjustment, edit `config.ini` in the installed plugin root, set `PreInputDelayMs` under `[Input]` to `15–250` and `KeyIntervalMs` to `1–250`, then restart Stream Dock. Defaults are `45` and `8`; out-of-range values are clamped.

For a temporary adjustment, drag the **Key Interval** action onto a Mirabox knob. Each detent changes the interval by `1 ms`, and a dynamically rendered image on the knob display shows the label and current value. The initial value comes from `config.ini`, remains in memory only, and returns to the configuration value after Stream Dock restarts.

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

GitHub Actions publishes all language editions together:

- Push `v1.2.0` to create one `Helldivers2Dock 1.2.0` release.
- The release contains both `Helldivers2Dock-en-1.2.0.zip` and `Helldivers2Dock-zh-CN-1.2.0.zip`.

The release workflow derives the version of every language manifest and archive from the same tag, performs one clean all-language build, validates plugin registration and archive contents, and uploads every language package to the same GitHub Release.

## Project layout

- `src/` — shared Node.js Stream Dock runtime.
- `native/` — Win32 input helper source.
- `scripts/` — data synchronization, i18n generation, validation, and packaging.
- `i18n/` — edition metadata and translations.
- `assets/` — tracked runtime icons, original wiki-source icons, and plugin icon.
- `data/stratagems.json` — tracked canonical stratagem catalog.
- `build/*.sdPlugin/` — generated installable plugin trees; ignored by Git.
- `.github/workflows/` — CI and the unified all-language release workflow.

## Copyright and attribution

The MIT license applies to the original source code only. *Helldivers 2* names, trademarks, and game-derived stratagem icons are not licensed under MIT and remain the property of their respective rights holders. They are included for identification in a non-commercial fan project; no affiliation or endorsement is implied.

Read [ASSET_LICENSE.md](ASSET_LICENSE.md) before redistributing a fork or release. It also records the wiki, SDK, localization, and structural references used by the project.
