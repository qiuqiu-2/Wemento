import { app, dialog } from 'electron'
import { configureApplicationDataPaths } from './application-data'

async function startApplication(): Promise<void> {
  try {
    const configured = configureApplicationDataPaths({ app })
    console.info(`[Wemento] application data (${configured.mode}): ${configured.layout.root}`)
    if (configured.migration.copiedFiles > 0) {
      console.info(
        `[Wemento] migrated ${configured.migration.copiedFiles} legacy data files to ${configured.layout.root}`
      )
    }
    if (configured.migration.failures.length > 0) {
      console.warn(
        '[Wemento] some legacy data files could not be copied; migration will retry next launch:',
        configured.migration.failures
      )
    }
    await import('./index')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Wemento] startup path initialization failed:', error)
    dialog.showErrorBox('Wemento 无法启动', message)
    app.quit()
  }
}

void startApplication()
