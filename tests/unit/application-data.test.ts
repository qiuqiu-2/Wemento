import type { App } from 'electron'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path, { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APPLICATION_DATA_ROOT_ENV,
  CONNECTOR_ACCOUNTS_DIR_ENV,
  buildApplicationDataLayout,
  buildLegacyMigrationSources,
  configureApplicationDataPaths,
  isPackagedApplication,
  migrateLegacyApplicationData,
  resolveApplicationDataRoot
} from '../../src/main/application-data'

const roots: string[] = []

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('unified application data directory', () => {
  it('recognizes packaged apps that retain electron.exe for WCDB compatibility', () => {
    const resources = temporaryRoot('wemento-packaged-resources-')
    expect(isPackagedApplication(false, resources)).toBe(false)
    writeFileSync(join(resources, 'app.asar'), 'fixture')
    expect(isPackagedApplication(false, resources)).toBe(true)
    expect(isPackagedApplication(true, '')).toBe(true)
  })

  it('places packaged Windows data beside the executable', () => {
    expect(
      resolveApplicationDataRoot({
        defaultUserData: 'C:\\Users\\fixture\\AppData\\Roaming\\wemento',
        env: {},
        execPath: 'D:\\Apps\\Wemento\\electron.exe',
        isPackaged: true,
        platform: 'win32'
      })
    ).toEqual({ mode: 'installed', root: 'D:\\Apps\\Wemento\\data' })
  })

  it('places single-file portable data beside the original portable executable', () => {
    expect(
      resolveApplicationDataRoot({
        defaultUserData: 'C:\\Users\\fixture\\AppData\\Roaming\\WechatExplorer',
        env: { PORTABLE_EXECUTABLE_DIR: 'E:\\Portable\\Wemento' },
        execPath: 'C:\\Users\\fixture\\AppData\\Local\\Temp\\portable\\electron.exe',
        isPackaged: true,
        platform: 'win32'
      })
    ).toEqual({ mode: 'installed', root: 'E:\\Portable\\Wemento\\data' })
  })

  it('includes legacy WechatExplorer and WeFlow user-data folders in migration', () => {
    const layout = buildApplicationDataLayout('D:\\Apps\\Wemento\\data')
    const sources = buildLegacyMigrationSources({
      appDataPath: 'C:\\Users\\fixture\\AppData\\Roaming',
      defaultUserData: 'C:\\Users\\fixture\\AppData\\Roaming\\wemento',
      homePath: 'C:\\Users\\fixture',
      layout,
      platform: 'win32'
    })

    expect(sources.map((source) => source.source)).toEqual(
      expect.arrayContaining([
        'C:\\Users\\fixture\\AppData\\Roaming\\WechatExplorer',
        'C:\\Users\\fixture\\AppData\\Roaming\\weflow'
      ])
    )
  })

  it('keeps explicit isolated data roots for development and tests', () => {
    const configured = path.resolve(temporaryRoot('wemento-data-override-'))
    expect(
      resolveApplicationDataRoot({
        defaultUserData: temporaryRoot('wemento-default-'),
        env: { [APPLICATION_DATA_ROOT_ENV]: configured },
        execPath: process.execPath,
        isPackaged: false,
        platform: process.platform
      })
    ).toEqual({ mode: 'isolated', root: configured })
  })

  it('copies legacy files without overwriting newer unified data', () => {
    const fixture = temporaryRoot('wemento-data-migration-')
    const legacy = join(fixture, 'legacy')
    const root = join(fixture, 'installed', 'data')
    const layout = buildApplicationDataLayout(root)
    mkdirSync(legacy, { recursive: true })
    mkdirSync(root, { recursive: true })
    writeFileSync(join(legacy, 'settings.json'), 'legacy')
    writeFileSync(join(legacy, 'local-api-token.bin'), 'token')
    writeFileSync(join(root, 'settings.json'), 'newer')

    const first = migrateLegacyApplicationData({
      layout,
      platform: process.platform,
      sources: [{ id: 'legacy-user-data', source: legacy, destination: root }]
    })

    expect(first.failures).toEqual([])
    expect(first.copiedFiles).toBe(1)
    expect(readFileSync(join(root, 'settings.json'), 'utf8')).toBe('newer')
    expect(readFileSync(join(root, 'local-api-token.bin'), 'utf8')).toBe('token')
    expect(existsSync(join(root, '.unified-data-v1.json'))).toBe(true)
    expect(
      migrateLegacyApplicationData({
        layout,
        platform: process.platform,
        sources: [{ id: 'legacy-user-data', source: legacy, destination: root }]
      }).skipped
    ).toBe(true)
  })

  it('sets every Electron-owned writable path before application modules load', () => {
    const root = temporaryRoot('wemento-configured-data-')
    const env: NodeJS.ProcessEnv = { [APPLICATION_DATA_ROOT_ENV]: root }
    const currentPaths = new Map<string, string>([
      ['userData', temporaryRoot('wemento-previous-data-')],
      ['documents', temporaryRoot('wemento-documents-')]
    ])
    const setPath = vi.fn((name: string, value: string) => currentPaths.set(name, value))
    const setName = vi.fn()
    const setAppLogsPath = vi.fn()
    const application = {
      isPackaged: false,
      getPath: (name: string) => currentPaths.get(name) || '',
      setPath,
      setName,
      setAppLogsPath
    } as unknown as App

    const configured = configureApplicationDataPaths({
      app: application,
      env,
      homePath: temporaryRoot('wemento-home-'),
      platform: process.platform
    })

    expect(configured.layout.root).toBe(path.resolve(root))
    expect(setPath).toHaveBeenCalledWith('userData', path.resolve(root))
    expect(setPath).toHaveBeenCalledWith('sessionData', path.resolve(root))
    expect(setPath).toHaveBeenCalledWith('logs', join(path.resolve(root), 'logs'))
    expect(setPath).toHaveBeenCalledWith('temp', join(path.resolve(root), 'temp'))
    expect(setPath).toHaveBeenCalledWith('crashDumps', join(path.resolve(root), 'crash-dumps'))
    expect(setAppLogsPath).toHaveBeenCalledWith(join(path.resolve(root), 'logs'))
    expect(env[CONNECTOR_ACCOUNTS_DIR_ENV]).toBe(join(path.resolve(root), 'connector', 'accounts'))
    expect(env.WE_SETTINGS_DIR).toBe(path.resolve(root))
  })
})
