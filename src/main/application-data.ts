import type { App } from 'electron'
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import os from 'os'
import path from 'path'

export const APPLICATION_DATA_ROOT_ENV = 'WEMENTO_DATA_ROOT'
export const CONNECTOR_ACCOUNTS_DIR_ENV = 'WEMENTO_CONNECTOR_ACCOUNTS_DIR'

const MIGRATION_MARKER = '.unified-data-v1.json'
const LEGACY_UPDATER_DIRECTORY = 'wemento-updater'

export type ApplicationDataMode = 'installed' | 'isolated' | 'standard'

export interface ApplicationDataLayout {
  root: string
  logs: string
  temp: string
  crashDumps: string
  exports: string
  generatedReports: string
  stickerCache: string
  connectorAccounts: string
  updates: string
}

export interface DataRootResolutionInput {
  defaultUserData: string
  env: NodeJS.ProcessEnv
  execPath: string
  isPackaged: boolean
  platform: NodeJS.Platform
}

export interface DataRootResolution {
  mode: ApplicationDataMode
  root: string
}

export interface LegacyMigrationSource {
  id: string
  source: string
  destination: string
}

export interface LegacyMigrationResult {
  copiedFiles: number
  failures: string[]
  skipped: boolean
}

export interface ConfigureApplicationDataOptions {
  app: App
  env?: NodeJS.ProcessEnv
  execPath?: string
  homePath?: string
  platform?: NodeJS.Platform
  resourcesPath?: string
}

export interface ConfiguredApplicationData {
  layout: ApplicationDataLayout
  migration: LegacyMigrationResult
  mode: ApplicationDataMode
  previousUserData: string
}

function resolveForPlatform(value: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? path.win32.resolve(value) : path.resolve(value)
}

export function isPackagedApplication(appIsPackaged: boolean, resourcesPath: string): boolean {
  return (
    appIsPackaged || (Boolean(resourcesPath) && existsSync(path.join(resourcesPath, 'app.asar')))
  )
}

export function resolveApplicationDataRoot(input: DataRootResolutionInput): DataRootResolution {
  const explicitRoot = String(input.env[APPLICATION_DATA_ROOT_ENV] || '').trim()
  if (explicitRoot) {
    return { mode: 'isolated', root: resolveForPlatform(explicitRoot, input.platform) }
  }

  const isolatedUserData = String(input.env['WXE_USER_DATA'] || '').trim()
  if (isolatedUserData) {
    return { mode: 'isolated', root: resolveForPlatform(isolatedUserData, input.platform) }
  }

  if (input.isPackaged && input.platform === 'win32') {
    const portableExecutableDirectory = String(input.env['PORTABLE_EXECUTABLE_DIR'] || '').trim()
    const executableDirectory = portableExecutableDirectory
      ? path.win32.resolve(portableExecutableDirectory)
      : path.win32.dirname(input.execPath)
    return {
      mode: 'installed',
      root: path.win32.join(executableDirectory, 'data')
    }
  }

  return { mode: 'standard', root: input.defaultUserData }
}

export function buildApplicationDataLayout(root: string): ApplicationDataLayout {
  return {
    root,
    logs: path.join(root, 'logs'),
    temp: path.join(root, 'temp'),
    crashDumps: path.join(root, 'crash-dumps'),
    exports: path.join(root, 'exports'),
    generatedReports: path.join(root, 'reports', 'generated'),
    stickerCache: path.join(root, 'cache', 'emojis'),
    connectorAccounts: path.join(root, 'connector', 'accounts'),
    updates: path.join(root, 'updates')
  }
}

function safeAppPath(application: App, name: Parameters<App['getPath']>[0]): string {
  try {
    return application.getPath(name)
  } catch {
    return ''
  }
}

function safeAppName(application: App): string {
  try {
    return application.getName()
  } catch {
    return ''
  }
}

function joinForPlatform(platform: NodeJS.Platform, ...segments: string[]): string {
  return platform === 'win32' ? path.win32.join(...segments) : path.join(...segments)
}

function legacyDefaultUserDataPath(
  application: App,
  appDataPath: string,
  platform: NodeJS.Platform
): string {
  const applicationName = safeAppName(application) || 'Wemento'
  return appDataPath ? joinForPlatform(platform, appDataPath, applicationName) : ''
}

function uniquePaths(values: string[], platform: NodeJS.Platform): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values.filter(Boolean)) {
    const resolved = path.resolve(value)
    const key = platform === 'win32' ? resolved.toLowerCase() : resolved
    if (seen.has(key)) continue
    seen.add(key)
    result.push(resolved)
  }
  return result
}

export function buildLegacyMigrationSources(options: {
  appDataPath?: string
  defaultUserData: string
  documentsPath?: string
  homePath: string
  layout: ApplicationDataLayout
  localAppDataPath?: string
  platform: NodeJS.Platform
}): LegacyMigrationSource[] {
  const userDataCandidates = uniquePaths(
    [
      options.defaultUserData,
      options.appDataPath ? path.join(options.appDataPath, 'wemento') : '',
      options.appDataPath ? path.join(options.appDataPath, 'Wemento') : '',
      options.appDataPath ? path.join(options.appDataPath, 'WechatExplorer') : '',
      options.appDataPath ? path.join(options.appDataPath, 'WeChatExplorer') : '',
      options.appDataPath ? path.join(options.appDataPath, 'weflow') : '',
      options.appDataPath ? path.join(options.appDataPath, 'WeFlow') : ''
    ],
    options.platform
  )
  const documentRoots = uniquePaths(
    [options.documentsPath || '', path.join(options.homePath, 'Documents')],
    options.platform
  )

  return [
    ...userDataCandidates.map((source, index) => ({
      id: `user-data-${index + 1}`,
      source,
      destination: options.layout.root
    })),
    ...documentRoots.map((source, index) => ({
      id: `exports-${index + 1}`,
      source: path.join(source, 'Wemento', '导出'),
      destination: options.layout.exports
    })),
    {
      id: 'generated-reports',
      source: path.join(options.homePath, 'Documents', '微信聊天记录'),
      destination: options.layout.generatedReports
    },
    {
      id: 'stickers',
      source: path.join(options.homePath, 'Documents', 'Wemento', 'Emojis'),
      destination: options.layout.stickerCache
    },
    {
      id: 'connector-accounts',
      source: path.join(options.homePath, '.wechatexplorer', 'wechat-connector', 'accounts'),
      destination: options.layout.connectorAccounts
    },
    ...(options.localAppDataPath
      ? [
          {
            id: 'updater-cache',
            source: path.join(options.localAppDataPath, LEGACY_UPDATER_DIRECTORY),
            destination: path.join(options.layout.updates, LEGACY_UPDATER_DIRECTORY)
          }
        ]
      : [])
  ]
}

function pathKey(value: string, platform: NodeJS.Platform): string {
  const resolved = path.resolve(value)
  return platform === 'win32' ? resolved.toLowerCase() : resolved
}

function destinationIsInsideSource(
  source: string,
  destination: string,
  platform: NodeJS.Platform
): boolean {
  const sourceKey = pathKey(source, platform)
  const destinationKey = pathKey(destination, platform)
  return destinationKey === sourceKey || destinationKey.startsWith(`${sourceKey}${path.sep}`)
}

function copyMissingTree(source: string, destination: string, result: LegacyMigrationResult): void {
  let sourceStat
  try {
    sourceStat = lstatSync(source)
  } catch (error) {
    result.failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`)
    return
  }

  if (sourceStat.isSymbolicLink()) return
  if (sourceStat.isDirectory()) {
    try {
      mkdirSync(destination, { recursive: true })
      for (const entry of readdirSync(source)) {
        copyMissingTree(path.join(source, entry), path.join(destination, entry), result)
      }
    } catch (error) {
      result.failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`)
    }
    return
  }
  if (!sourceStat.isFile()) return

  try {
    mkdirSync(path.dirname(destination), { recursive: true })
    copyFileSync(source, destination, constants.COPYFILE_EXCL)
    result.copiedFiles += 1
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      result.failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export function migrateLegacyApplicationData(options: {
  layout: ApplicationDataLayout
  platform: NodeJS.Platform
  sources: LegacyMigrationSource[]
}): LegacyMigrationResult {
  const markerPath = path.join(options.layout.root, MIGRATION_MARKER)
  if (existsSync(markerPath)) return { copiedFiles: 0, failures: [], skipped: true }

  const result: LegacyMigrationResult = { copiedFiles: 0, failures: [], skipped: false }
  const attempted: string[] = []
  for (const migration of options.sources) {
    if (!existsSync(migration.source)) continue
    if (destinationIsInsideSource(migration.source, migration.destination, options.platform)) {
      continue
    }
    attempted.push(migration.id)
    copyMissingTree(migration.source, migration.destination, result)
  }

  if (result.failures.length === 0) {
    writeFileSync(
      markerPath,
      `${JSON.stringify(
        {
          version: 1,
          completedAt: new Date().toISOString(),
          copiedFiles: result.copiedFiles,
          sources: attempted
        },
        null,
        2
      )}\n`,
      'utf8'
    )
  }
  return result
}

function ensureWritableDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true })
  const probe = path.join(directory, `.write-test-${process.pid}-${Date.now()}`)
  try {
    writeFileSync(probe, 'ok', { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    throw new Error(
      `统一数据目录不可写：${directory}\n请将 Wemento 安装到当前用户有写入权限的位置。\n${
        error instanceof Error ? error.message : String(error)
      }`
    )
  } finally {
    try {
      rmSync(probe, { force: true })
    } catch {
      // A failed probe has nothing to clean up.
    }
  }
}

export function configureApplicationDataPaths(
  options: ConfigureApplicationDataOptions
): ConfiguredApplicationData {
  const application = options.app
  const env = options.env || process.env
  const platform = options.platform || process.platform
  const execPath = options.execPath || process.execPath
  const resourcesPath = options.resourcesPath || process.resourcesPath || ''
  const homePath = options.homePath || os.homedir()
  const packaged = isPackagedApplication(application.isPackaged, resourcesPath)

  // Reading Electron's default userData path creates that directory on Windows.
  // First resolve every mode that has an independent root, and only ask Electron
  // for its default in standard development mode where that path is actually used.
  let resolution = resolveApplicationDataRoot({
    defaultUserData: '',
    env,
    execPath,
    isPackaged: packaged,
    platform
  })
  let previousUserData = ''
  let appDataPath = ''
  let documentsPath = ''
  if (resolution.mode === 'standard') {
    previousUserData = safeAppPath(application, 'userData')
    resolution = resolveApplicationDataRoot({
      defaultUserData: previousUserData,
      env,
      execPath,
      isPackaged: packaged,
      platform
    })
  } else if (resolution.mode === 'installed') {
    appDataPath = String(env.APPDATA || '').trim() || safeAppPath(application, 'appData')
    previousUserData = legacyDefaultUserDataPath(application, appDataPath, platform)
    documentsPath = safeAppPath(application, 'documents')
  }
  const layout = buildApplicationDataLayout(resolution.root)

  ensureWritableDirectory(layout.root)
  for (const directory of [
    layout.logs,
    layout.temp,
    layout.crashDumps,
    layout.exports,
    layout.generatedReports,
    layout.stickerCache,
    layout.connectorAccounts,
    layout.updates
  ]) {
    mkdirSync(directory, { recursive: true })
  }

  application.setName(
    platform === 'win32' ? 'WeFlow' : env['WXE_USER_DATA'] ? 'Wemento Dev' : 'Wemento'
  )
  application.setPath('userData', layout.root)
  application.setPath('sessionData', layout.root)
  application.setPath('logs', layout.logs)
  application.setPath('temp', layout.temp)
  application.setPath('crashDumps', layout.crashDumps)
  application.setAppLogsPath(layout.logs)

  env[APPLICATION_DATA_ROOT_ENV] = layout.root
  env[CONNECTOR_ACCOUNTS_DIR_ENV] = layout.connectorAccounts
  env['WE_SETTINGS_DIR'] = layout.root

  const migration =
    resolution.mode === 'installed'
      ? migrateLegacyApplicationData({
          layout,
          platform,
          sources: buildLegacyMigrationSources({
            appDataPath,
            defaultUserData: previousUserData,
            documentsPath,
            homePath,
            layout,
            localAppDataPath: env.LOCALAPPDATA,
            platform
          })
        })
      : { copiedFiles: 0, failures: [], skipped: true }

  return { layout, migration, mode: resolution.mode, previousUserData }
}
