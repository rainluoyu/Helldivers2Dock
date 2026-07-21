param(
    [ValidateSet('all', 'en', 'zh-CN')]
    [string]$Locale = 'all'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Test-ReleaseArchive {
    param([string]$Archive, [string]$RootDirectory)

    $zip = [System.IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        $entries = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
        $required = @(
            "$RootDirectory/manifest.json",
            "$RootDirectory/plugin/index.js",
            "$RootDirectory/plugin/bin/StratagemInput.exe",
            "$RootDirectory/data/stratagems.json",
            "$RootDirectory/LICENSE",
            "$RootDirectory/ASSET_LICENSE.md"
        )
        foreach ($entry in $required) {
            if ($entries -notcontains $entry) { throw "Release archive is missing $entry" }
        }
        $forbidden = $entries | Where-Object {
            $_ -match '(^|/)(src|native|scripts|i18n|node_modules|wiki-original)(/|$)' -or
            $_ -match '\.SDProfile$|(^|/)README(?:\.|$)|\.git'
        }
        if ($forbidden) { throw "Release archive contains non-runtime files: $($forbidden -join ', ')" }
        $outsideRoot = $entries | Where-Object { $_ -notlike "$RootDirectory/*" }
        if ($outsideRoot) { throw "Release archive contains files outside $RootDirectory" }
    }
    finally {
        $zip.Dispose()
    }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null

$packages = @(
    @{ Locale = 'en'; Directory = 'com.n4pro.helldivers2dock.sdPlugin'; I18n = 'i18n\en.json'; Suffix = 'en' },
    @{ Locale = 'zh-CN'; Directory = 'com.n4pro.helldivers2dock.zh-cn.sdPlugin'; I18n = 'i18n\zh-CN.json'; Suffix = 'zh-CN' }
)

foreach ($package in $packages) {
    if ($Locale -ne 'all' -and $Locale -ne $package.Locale) { continue }

    $plugin = (Resolve-Path (Join-Path $root "build\$($package.Directory)")).Path
    $localeData = Get-Content -Raw -Encoding UTF8 (Join-Path $root $package.I18n) | ConvertFrom-Json
    $version = if ($env:PLUGIN_VERSION) { $env:PLUGIN_VERSION } else { $localeData.version }
    if ($version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') {
        throw "Invalid release version: $version"
    }

    $archive = Join-Path $dist "Helldivers2Dock-$($package.Suffix)-$version.zip"
    $stagingRoot = Join-Path $dist ".staging-$($package.Locale)-$([guid]::NewGuid().ToString('N'))"
    $stagedPlugin = Join-Path $stagingRoot $package.Directory

    try {
        New-Item -ItemType Directory -Force -Path $stagedPlugin | Out-Null
        foreach ($file in @('manifest.json', 'en.json', 'zh_CN.json')) {
            Copy-Item -LiteralPath (Join-Path $plugin $file) -Destination (Join-Path $stagedPlugin $file)
        }
        Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination (Join-Path $stagedPlugin 'LICENSE')
        Copy-Item -LiteralPath (Join-Path $root 'ASSET_LICENSE.md') -Destination (Join-Path $stagedPlugin 'ASSET_LICENSE.md')
        foreach ($directory in @('plugin', 'static')) {
            Copy-Item -LiteralPath (Join-Path $plugin $directory) -Destination $stagedPlugin -Recurse
        }
        New-Item -ItemType Directory -Force -Path (Join-Path $stagedPlugin 'data') | Out-Null
        Copy-Item -LiteralPath (Join-Path $plugin 'data\stratagems.json') -Destination (Join-Path $stagedPlugin 'data\stratagems.json')
        New-Item -ItemType Directory -Force -Path (Join-Path $stagedPlugin 'images') | Out-Null
        Copy-Item -LiteralPath (Join-Path $plugin 'images\actions') -Destination (Join-Path $stagedPlugin 'images') -Recurse

        if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
        Compress-Archive -LiteralPath $stagedPlugin -DestinationPath $archive -CompressionLevel Optimal
        Test-ReleaseArchive -Archive $archive -RootDirectory $package.Directory
        Write-Output "Created clean $($package.Locale) release: $archive"
    }
    finally {
        if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
    }
}
