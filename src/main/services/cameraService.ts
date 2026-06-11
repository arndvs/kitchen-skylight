import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { app, safeStorage } from 'electron'
import { WebSocketServer, WebSocket } from 'ws'
import ffmpegStatic from 'ffmpeg-static'
import { uuidv7 } from '@shared/uuid'
import type { CameraDto } from '@shared/types'
import type { SettingsService } from './settingsService'
import { AppError, invalid, notFound } from './errors'

const KEY_CAMERAS = 'cameras.v1'
const MAX_CLIENT_BUFFER = 8 * 1024 * 1024 // drop clients that fall this far behind

import { buildFfmpegArgs, isValidRtspUrl } from './cameraArgs'

/**
 * RTSP camera streaming. ffmpeg pulls the camera feed and REMUXES it (H.264
 * copy, no transcode) into MPEG-TS on stdout; we relay those bytes to tile
 * clients over a token-gated WebSocket bound to 127.0.0.1. Camera URLs hold
 * credentials, so they are encrypted at rest and never leave the main process.
 */

export function resolveFfmpegPath(): string | null {
  const p = ffmpegStatic as unknown as string | null
  if (!p) return null
  return app.isPackaged ? p.replace('app.asar', 'app.asar.unpacked') : p
}

function encryptUrl(plain: string): string {
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(plain)
    : Buffer.from(`plain:${plain}`, 'utf8')
  return buf.toString('base64')
}

function decryptUrl(b64: string): string {
  const buf = Buffer.from(b64, 'base64')
  const asString = buf.toString('utf8')
  if (asString.startsWith('plain:')) return asString.slice(6)
  return safeStorage.decryptString(buf)
}

interface StoredCamera {
  id: string
  name: string
  urlEnc: string
}

interface ActiveStream {
  proc: ChildProcess
  clients: Set<WebSocket>
  refs: number
  stderrTail: string
}

export function createCameraService(settings: SettingsService) {
  const streams = new Map<string, ActiveStream>()
  const token = randomBytes(16).toString('hex')
  let wss: WebSocketServer | null = null
  let wssPort: Promise<number> | null = null

  function loadCameras(): StoredCamera[] {
    try {
      const raw = settings.getRaw(KEY_CAMERAS)
      const parsed = raw ? (JSON.parse(raw) as StoredCamera[]) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function saveCameras(cameras: StoredCamera[]): void {
    settings.setRaw(KEY_CAMERAS, JSON.stringify(cameras))
  }

  function list(): CameraDto[] {
    return loadCameras().map((c) => ({ id: c.id, name: c.name }))
  }

  function add(name: string, url: string): CameraDto {
    if (!isValidRtspUrl(url)) throw invalid('Must be an rtsp:// or rtsps:// URL')
    const cameras = loadCameras()
    const camera: StoredCamera = { id: uuidv7(), name, urlEnc: encryptUrl(url.trim()) }
    cameras.push(camera)
    saveCameras(cameras)
    return { id: camera.id, name: camera.name }
  }

  function remove(cameraId: string): void {
    const cameras = loadCameras()
    if (!cameras.some((c) => c.id === cameraId)) throw notFound('Camera')
    killStream(cameraId)
    saveCameras(cameras.filter((c) => c.id !== cameraId))
  }

  /** Lazy localhost-only WebSocket relay; one server for all cameras. */
  function ensureServer(): Promise<number> {
    if (wssPort) return wssPort
    wssPort = new Promise((resolve, reject) => {
      wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
      wss.on('listening', () => {
        const address = wss!.address()
        resolve(typeof address === 'object' && address ? address.port : 0)
      })
      wss.on('error', (err) => reject(err))
      wss.on('connection', (ws, req) => {
        const url = new URL(req.url ?? '/', 'ws://127.0.0.1')
        const cameraId = url.pathname.replace(/^\//, '')
        const stream = streams.get(cameraId)
        if (url.searchParams.get('token') !== token || !stream) {
          ws.close(4001, 'unauthorized')
          return
        }
        stream.clients.add(ws)
        ws.on('close', () => stream.clients.delete(ws))
      })
    })
    return wssPort
  }

  function killStream(cameraId: string): void {
    const stream = streams.get(cameraId)
    if (!stream) return
    streams.delete(cameraId)
    for (const client of stream.clients) client.close(4002, 'stream stopped')
    stream.clients.clear()
    try {
      stream.proc.kill()
    } catch {
      // already dead
    }
  }

  function spawnStream(cameraId: string, rtspUrl: string): ActiveStream {
    const ffmpeg = resolveFfmpegPath()
    if (!ffmpeg) throw new AppError('FFMPEG_MISSING', 'ffmpeg binary not found — reinstall the app')
    const proc = spawn(ffmpeg, buildFfmpegArgs(rtspUrl), { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const stream: ActiveStream = { proc, clients: new Set(), refs: 0, stderrTail: '' }

    proc.stdout!.on('data', (chunk: Buffer) => {
      for (const client of stream.clients) {
        if (client.readyState !== WebSocket.OPEN) continue
        if (client.bufferedAmount > MAX_CLIENT_BUFFER) {
          client.close(4003, 'client too slow')
          continue
        }
        client.send(chunk)
      }
    })
    proc.stderr!.on('data', (chunk: Buffer) => {
      stream.stderrTail = (stream.stderrTail + chunk.toString()).slice(-2000)
    })
    proc.on('exit', (code) => {
      // closing the sockets tells tiles to show the retry state
      if (streams.get(cameraId) === stream) {
        console.error(`[camera] ffmpeg exited (${code}) for ${cameraId}:`, stream.stderrTail.slice(-500))
        streams.delete(cameraId)
        for (const client of stream.clients) client.close(4002, 'stream ended')
        stream.clients.clear()
      }
    })
    streams.set(cameraId, stream)
    return stream
  }

  /** Start (or join) a camera stream; returns the playable WebSocket URL. */
  async function start(cameraId: string): Promise<{ wsUrl: string }> {
    const camera = loadCameras().find((c) => c.id === cameraId)
    if (!camera) throw notFound('Camera')
    const port = await ensureServer()
    let stream = streams.get(cameraId)
    if (!stream || stream.proc.exitCode !== null) {
      stream = spawnStream(cameraId, decryptUrl(camera.urlEnc))
    }
    stream.refs += 1
    return { wsUrl: `ws://127.0.0.1:${port}/${cameraId}?token=${token}` }
  }

  function stop(cameraId: string): void {
    const stream = streams.get(cameraId)
    if (!stream) return
    stream.refs -= 1
    if (stream.refs <= 0) killStream(cameraId)
  }

  /** Kill every ffmpeg on app quit. */
  function shutdown(): void {
    for (const cameraId of [...streams.keys()]) killStream(cameraId)
    wss?.close()
  }

  return { list, add, remove, start, stop, shutdown }
}

export type CameraService = ReturnType<typeof createCameraService>
