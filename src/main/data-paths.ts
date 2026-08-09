import { app } from 'electron'
import path from 'path'
import { APPLICATION_DATA_ROOT_ENV } from './application-data'

export function getApplicationDataRoot(): string {
  const configured = String(process.env[APPLICATION_DATA_ROOT_ENV] || '').trim()
  return configured ? path.resolve(configured) : app.getPath('userData')
}

export function getApplicationDataPath(...segments: string[]): string {
  return path.join(getApplicationDataRoot(), ...segments)
}

export const getExportRoot = (): string => getApplicationDataPath('exports')
export const getGeneratedReportRoot = (): string => getApplicationDataPath('reports', 'generated')
export const getStickerCacheRoot = (): string => getApplicationDataPath('cache', 'emojis')
export const getApplicationTempRoot = (): string => getApplicationDataPath('temp')
export const getUpdateCacheRoot = (): string => getApplicationDataPath('updates')
