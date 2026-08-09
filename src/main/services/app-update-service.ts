import { app, BrowserWindow } from 'electron'
import { autoUpdater, NsisUpdater, type AppUpdater, type ProgressInfo } from 'electron-updater'
import type { InstallOptions } from 'electron-updater/out/BaseUpdater'
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import os from 'os'
import path from 'path'
import type { AppUpdateCheckResult, AppUpdateState } from '../../shared/app-update'
import { isPackagedRuntime } from '../runtime-mode'
import { getApplicationDataRoot, getUpdateCacheRoot } from '../data-paths'

const UPDATE_STAGING_DIRECTORY = path.join(os.tmpdir(), 'wemento-update-staging')

function cleanupStagedUpdateInstallers(): void {
  try {
    for (const entry of readdirSync(UPDATE_STAGING_DIRECTORY)) {
      const target = path.join(UPDATE_STAGING_DIRECTORY, entry)
      if (statSync(target).isFile()) rmSync(target, { force: true })
    }
    rmSync(UPDATE_STAGING_DIRECTORY, { force: true })
  } catch {
    // The installer that launched the app can still be locked. Retry next launch.
  }
}

function isInsideDirectory(directory: string, candidate: string): boolean {
  const relative = path.relative(directory, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

class UnifiedDataNsisUpdater extends NsisUpdater {
  private stagedInstallerPath: string | null = null

  protected override get installerPath(): string | null {
    return this.stagedInstallerPath || super.installerPath
  }

  protected override doInstall(options: InstallOptions): boolean {
    const downloadedInstaller = super.installerPath
    if (downloadedInstaller && isInsideDirectory(getApplicationDataRoot(), downloadedInstaller)) {
      try {
        mkdirSync(UPDATE_STAGING_DIRECTORY, { recursive: true })
        const stagedPath = path.join(
          UPDATE_STAGING_DIRECTORY,
          `wemento-update-${process.pid}-${Date.now()}-${path.basename(downloadedInstaller)}`
        )
        copyFileSync(downloadedInstaller, stagedPath)
        this.stagedInstallerPath = stagedPath
      } catch (error) {
        this.dispatchError(
          new Error(`无法暂存更新安装包：${error instanceof Error ? error.message : String(error)}`)
        )
        return false
      }
    }
    return super.doInstall(options)
  }
}

function createApplicationUpdater(): AppUpdater {
  if (process.platform !== 'win32') return autoUpdater

  const adapter = {
    whenReady: (): Promise<void> => app.whenReady(),
    get version(): string {
      return app.getVersion()
    },
    get name(): string {
      return app.getName()
    },
    get isPackaged(): boolean {
      return isPackagedRuntime()
    },
    get appUpdateConfigPath(): string {
      return isPackagedRuntime()
        ? path.join(process.resourcesPath, 'app-update.yml')
        : path.join(app.getAppPath(), 'dev-app-update.yml')
    },
    get userDataPath(): string {
      return app.getPath('userData')
    },
    get baseCachePath(): string {
      return getUpdateCacheRoot()
    },
    quit: (): void => app.quit(),
    relaunch: (): void => app.relaunch(),
    onQuit: (handler: (exitCode: number) => void): void => {
      app.once('quit', (_event, exitCode) => handler(exitCode))
    }
  }
  return new UnifiedDataNsisUpdater(null, adapter)
}

cleanupStagedUpdateInstallers()
const applicationUpdater = createApplicationUpdater()

export class AppUpdateService {
  private state: AppUpdateState = {
    status: 'idle',
    currentVersion: app.getVersion()
  }

  constructor() {
    applicationUpdater.autoDownload = false
    applicationUpdater.autoInstallOnAppQuit = true
    applicationUpdater.on('checking-for-update', () => this.setState({ status: 'checking' }))
    applicationUpdater.on('update-available', (info) =>
      this.setState({ status: 'available', version: info.version, message: '发现新版本' })
    )
    applicationUpdater.on('update-not-available', () =>
      this.setState({ status: 'not-available', message: '当前已是最新版本' })
    )
    applicationUpdater.on('download-progress', (progress: ProgressInfo) =>
      this.setState({
        status: 'downloading',
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      })
    )
    applicationUpdater.on('update-downloaded', (info) =>
      this.setState({
        status: 'downloaded',
        version: info.version,
        percent: 100,
        message: '更新已下载'
      })
    )
    applicationUpdater.on('error', (error) =>
      this.setState({ status: 'error', message: error.message || '更新失败' })
    )
  }

  getState(): AppUpdateState {
    return { ...this.state, currentVersion: app.getVersion() }
  }

  async check(): Promise<AppUpdateCheckResult> {
    if (!isPackagedRuntime()) {
      const state = this.setState({
        status: 'unsupported',
        message: '开发模式不执行安装包更新，请在正式安装包中检查更新'
      })
      return { success: false, state }
    }
    try {
      const result = await applicationUpdater.checkForUpdates()
      if (result?.updateInfo.version) {
        this.setState({
          status: 'available',
          version: result.updateInfo.version,
          message: '发现新版本'
        })
      }
      return { success: true, state: this.getState() }
    } catch (error) {
      const state = this.setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      })
      return { success: false, state }
    }
  }

  async download(): Promise<AppUpdateCheckResult> {
    if (!isPackagedRuntime()) {
      const state = this.setState({ status: 'unsupported', message: '开发模式不能下载更新' })
      return { success: false, state }
    }
    try {
      this.setState({ status: 'downloading', percent: 0 })
      await applicationUpdater.downloadUpdate()
      return { success: true, state: this.getState() }
    } catch (error) {
      const state = this.setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      })
      return { success: false, state }
    }
  }

  install(): { success: boolean; error?: string } {
    if (this.state.status !== 'downloaded') {
      return { success: false, error: '更新包尚未下载完成' }
    }
    applicationUpdater.quitAndInstall()
    return { success: true }
  }

  handleState(callback: (state: AppUpdateState) => void): () => void {
    this.listeners.add(callback)
    callback(this.getState())
    return () => this.listeners.delete(callback)
  }

  private listeners = new Set<(state: AppUpdateState) => void>()

  private setState(patch: Partial<AppUpdateState>): AppUpdateState {
    this.state = { ...this.state, ...patch, currentVersion: app.getVersion() }
    const state = this.getState()
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('app-update:state', state)
    }
    for (const listener of this.listeners) listener(state)
    return state
  }
}

export const appUpdateService = new AppUpdateService()
