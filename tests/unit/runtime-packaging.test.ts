import { createRequire } from 'module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { afterAll, describe, expect, it } from 'vitest'

const nodeRequire = createRequire(import.meta.url)
const asar = nodeRequire('@electron/asar') as {
  createPackage: (source: string, destination: string) => Promise<void>
}
const yaml = nodeRequire('js-yaml') as {
  load: (source: string) => Record<string, unknown>
}
const { getNodeModuleFileMatcher } = nodeRequire('app-builder-lib/out/fileMatcher') as {
  getNodeModuleFileMatcher: (
    appDir: string,
    destination: string,
    macroExpander: (value: string) => string,
    platformSpecificBuildOptions: Record<string, unknown>,
    packager: {
      config: Record<string, unknown>
      debugLogger: { isEnabled: boolean }
    }
  ) => { patterns: string[] }
}
const {
  REQUIRED_RUNTIME_PACKAGES,
  validateAsarRuntimeDependencies,
  validateFfmpegRuntime,
  validateReaderSkillRuntime,
  validateSherpaRuntime,
  validateSilkWasmRuntime
} = nodeRequire('../../scripts/after-pack.cjs') as {
  REQUIRED_RUNTIME_PACKAGES: string[]
  validateAsarRuntimeDependencies: (runtimeResources: string) => void
  validateFfmpegRuntime: (runtimeResources: string, platform?: NodeJS.Platform) => void
  validateReaderSkillRuntime: (runtimeResources: string) => string
  validateSherpaRuntime: (runtimeResources: string, platform: NodeJS.Platform, arch: string) => void
  validateSilkWasmRuntime: (runtimeResources: string) => void
}
const root = mkdtempSync(join(tmpdir(), 'wxe-runtime-package-'))

describe('production runtime packaging', () => {
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('requires the complete unpacked silk-wasm runtime', () => {
    const packagePath = join(root, 'resources', 'app.asar.unpacked', 'node_modules', 'silk-wasm')
    mkdirSync(join(packagePath, 'lib'), { recursive: true })
    writeFileSync(join(packagePath, 'package.json'), '{}')
    writeFileSync(join(packagePath, 'lib', 'index.cjs'), 'module.exports = {}')

    expect(() => validateSilkWasmRuntime(join(root, 'resources'))).toThrow(/silk\.wasm/)
    writeFileSync(join(packagePath, 'lib', 'silk.wasm'), Buffer.from([0, 97, 115, 109]))
    expect(() => validateSilkWasmRuntime(join(root, 'resources'))).not.toThrow()
  })

  it('requires the bundled Reader Skill declared by extraResources', () => {
    const resources = join(root, 'reader-skill-resources')
    const skillPath = join(resources, 'skill', 'wechatexplorer-reader', 'SKILL.md')
    const config = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf8')

    expect(config).toContain('docs/skill/wechatexplorer-reader')
    expect(config).toContain('to: skill/wechatexplorer-reader')
    expect(() => validateReaderSkillRuntime(resources)).toThrow(
      /Missing bundled Wemento Reader Skill/
    )

    mkdirSync(dirname(skillPath), { recursive: true })
    writeFileSync(skillPath, '# Wemento Reader\n')
    expect(validateReaderSkillRuntime(resources)).toBe(skillPath)
  })

  it('keeps silk-wasm in electron-builder asarUnpack', () => {
    const config = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf8')
    expect(config).toContain('node_modules/silk-wasm/**')
  })

  it('does not apply app output filters to collected production dependencies', () => {
    const projectRoot = resolve(__dirname, '../..')
    const source = readFileSync(join(projectRoot, 'electron-builder.yml'), 'utf8')
    const config = yaml.load(source) as { files?: unknown; win?: Record<string, unknown> }
    const normalizedConfig = {
      ...config,
      files: [{ filter: config.files }]
    }
    const matcher = getNodeModuleFileMatcher(
      projectRoot,
      join(projectRoot, 'dist', 'app'),
      (value) => value,
      config.win ?? {},
      { config: normalizedConfig, debugLogger: { isEnabled: false } }
    )

    expect(source).toContain('  - out')
    expect(matcher.patterns).not.toContain('out')
  })

  it('publishes both the Windows installer and portable archive', () => {
    const config = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf8')
    expect(config).toContain('artifactName: ${name}-${version}-portable-${os}-${arch}.${ext}')
    expect(config).toContain('- target: nsis')
    expect(config).toContain('- target: zip')
  })

  it('loads packaged UI runtime files independently of main-process chunk placement', () => {
    const mainSource = readFileSync(resolve(__dirname, '../../src/main/index.ts'), 'utf8')
    expect(mainSource).toContain("join(app.getAppPath(), 'out/renderer/index.html')")
    expect(mainSource).toContain("join(app.getAppPath(), 'out/preload/index.js')")
    expect(mainSource).toContain(
      "join(app.getAppPath(), 'out/main/voiceRecognitionWorker.js')"
    )
    expect(mainSource).toContain("join(app.getAppPath(), 'out/main/knowledgeWorker.js')")
    expect(mainSource).not.toContain("join(__dirname, '../renderer/index.html')")
    expect(mainSource).not.toContain("join(__dirname, '../preload/index.js')")
    expect(mainSource).not.toContain("join(__dirname, 'voiceRecognitionWorker.js')")
    expect(mainSource).not.toContain("join(__dirname, 'knowledgeWorker.js')")
  })

  it('uses legacy electron.exe packaged detection for the updater adapter', () => {
    const updaterSource = readFileSync(
      resolve(__dirname, '../../src/main/services/app-update-service.ts'),
      'utf8'
    )
    expect(updaterSource).toContain('get isPackaged(): boolean')
    expect(updaterSource).toContain('return isPackagedRuntime()')
    expect(updaterSource).not.toContain('return app.isPackaged')
    expect(updaterSource).not.toContain('app.isPackaged\n        ?')
  })

  it('keeps image decoder temporary files inside the unified data directory', () => {
    const imageDecryptSource = readFileSync(
      resolve(__dirname, '../../src/main/image-decrypt-service.ts'),
      'utf8'
    )
    expect(imageDecryptSource).toContain('tempDir: getApplicationTempRoot()')
    expect(imageDecryptSource).not.toContain("const os = require('node:os')")
    expect(imageDecryptSource).not.toContain('workerData.tempDir || os.tmpdir()')
  })

  it('patches the legacy NSIS current-user install-directory lookup', () => {
    const projectPackage = JSON.parse(
      readFileSync(resolve(__dirname, '../../package.json'), 'utf8')
    ) as { pnpm?: { patchedDependencies?: Record<string, string> } }
    expect(projectPackage.pnpm?.patchedDependencies?.['app-builder-lib@26.0.12']).toBe(
      'patches/app-builder-lib@26.0.12.patch'
    )

    const electronBuilderRequire = createRequire(
      nodeRequire.resolve('electron-builder/package.json')
    )
    const appBuilderPackage = electronBuilderRequire.resolve('app-builder-lib/package.json')
    const multiUserTemplate = readFileSync(
      join(dirname(appBuilderPackage), 'templates', 'nsis', 'multiUser.nsh'),
      'utf8'
    )
    expect(multiUserTemplate).not.toContain("System::Call 'SHELL32::SHGetKnownFolderPath")
    expect(multiUserTemplate).toContain('$LocalAppData\\Programs\\${APP_FILENAME}')
  })

  it('keeps unified application data across installer upgrades and uninstall', () => {
    const installerInclude = readFileSync(resolve(__dirname, '../../build/installer.nsh'), 'utf8')
    expect(installerInclude).toContain('!macro customInstallMode')
    expect(installerInclude).toContain('StrCpy $isForceCurrentInstall "1"')
    expect(installerInclude).toContain('!macro customRemoveFiles')
    expect(installerInclude).toContain('$INSTDIR.wemento-data-backup')
    expect(installerInclude).toContain('Rename "$INSTDIR\\data" "$R8"')
    expect(installerInclude).toContain('Rename "$R8" "$INSTDIR\\data"')
    expect(installerInclude).toContain(
      '${If} ${FileExists} "$INSTDIR\\${APP_EXECUTABLE_FILENAME}"'
    )
    expect(installerInclude).toContain(
      '${ElseIf} ${FileExists} "$INSTDIR\\resources\\app.asar"'
    )
    expect(installerInclude).toContain('"--delete-app-data"')
  })

  it('rejects an app archive with missing runtime dependencies', async () => {
    const resources = join(root, 'asar-resources')
    const source = join(root, 'asar-source')
    mkdirSync(source, { recursive: true })
    writeFileSync(join(source, 'package.json'), '{}')
    mkdirSync(resources, { recursive: true })
    await asar.createPackage(source, join(resources, 'app.asar'))

    expect(() => validateAsarRuntimeDependencies(resources)).toThrow(
      /Missing packaged runtime dependencies:.*@electron-toolkit\/utils/
    )
  })

  it('accepts a complete runtime dependency archive on Windows', async () => {
    const resources = join(root, 'complete-asar-resources')
    const source = join(root, 'complete-asar-source')
    for (const packageName of REQUIRED_RUNTIME_PACKAGES) {
      const packagePath = join(source, 'node_modules', packageName)
      mkdirSync(packagePath, { recursive: true })
      writeFileSync(join(packagePath, 'package.json'), '{}')
    }
    mkdirSync(resources, { recursive: true })
    await asar.createPackage(source, join(resources, 'app.asar'))

    expect(() => validateAsarRuntimeDependencies(resources)).not.toThrow()
  })

  it('requires and unpacks the bundled ffmpeg-static executable', () => {
    const resources = join(root, 'ffmpeg-resources')
    const ffmpegPath = join(
      resources,
      'app.asar.unpacked',
      'node_modules',
      'ffmpeg-static',
      'ffmpeg'
    )
    expect(() => validateFfmpegRuntime(resources, 'darwin')).toThrow(/ffmpeg-static/)
    mkdirSync(dirname(ffmpegPath), { recursive: true })
    writeFileSync(ffmpegPath, 'fixture')
    expect(() => validateFfmpegRuntime(resources, 'darwin')).not.toThrow()

    const config = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf8')
    expect(config).toContain('node_modules/ffmpeg-static/**')
  })

  it('requires the matching Windows and macOS sherpa native runtime', () => {
    const resources = join(root, 'sherpa-resources')
    const unpacked = join(resources, 'app.asar.unpacked', 'node_modules')
    const base = join(unpacked, 'sherpa-onnx-node')
    mkdirSync(base, { recursive: true })
    writeFileSync(join(base, 'package.json'), '{}')
    writeFileSync(join(base, 'sherpa-onnx.js'), 'module.exports = {}')

    expect(() => validateSherpaRuntime(resources, 'win32', 'x64')).toThrow(/win-x64/)
    const windows = join(unpacked, 'sherpa-onnx-win-x64')
    mkdirSync(windows, { recursive: true })
    writeFileSync(join(windows, 'package.json'), '{}')
    writeFileSync(join(windows, 'sherpa-onnx.node'), 'fixture')
    expect(() => validateSherpaRuntime(resources, 'win32', 'x64')).not.toThrow()

    expect(() => validateSherpaRuntime(resources, 'darwin', 'arm64')).toThrow(/darwin-arm64/)
    const mac = join(unpacked, 'sherpa-onnx-darwin-arm64')
    mkdirSync(mac, { recursive: true })
    writeFileSync(join(mac, 'package.json'), '{}')
    writeFileSync(join(mac, 'sherpa-onnx.node'), 'fixture')
    expect(() => validateSherpaRuntime(resources, 'darwin', 'arm64')).not.toThrow()

    const config = readFileSync(resolve(__dirname, '../../electron-builder.yml'), 'utf8')
    expect(config).toContain('node_modules/sherpa-onnx-node/**')
    expect(config).toContain('node_modules/sherpa-onnx-*/**')
  })
})
