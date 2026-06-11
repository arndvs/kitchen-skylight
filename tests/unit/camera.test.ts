import { describe, expect, it } from 'vitest'
import { buildFfmpegArgs, isValidRtspUrl } from '../../src/main/services/cameraArgs'
import { sanitizeLayout, TILE_SPECS } from '../../src/shared/home'

describe('isValidRtspUrl', () => {
  it('accepts rtsp and rtsps URLs with hosts', () => {
    expect(isValidRtspUrl('rtsp://192.168.1.50:554/stream1')).toBe(true)
    expect(isValidRtspUrl('rtsps://user:pa%40ss@cam.local/live')).toBe(true)
    expect(isValidRtspUrl('RTSP://CAM/UPPER')).toBe(true)
  })
  it('rejects everything else', () => {
    expect(isValidRtspUrl('http://example.com/stream')).toBe(false)
    expect(isValidRtspUrl('rtsp://')).toBe(false)
    expect(isValidRtspUrl('file:///etc/passwd')).toBe(false)
    expect(isValidRtspUrl('not a url')).toBe(false)
  })
})

describe('buildFfmpegArgs', () => {
  const args = buildFfmpegArgs('rtsp://cam/stream')
  it('remuxes without transcoding and writes MPEG-TS to stdout', () => {
    expect(args).toContain('-c:v')
    expect(args[args.indexOf('-c:v') + 1]).toBe('copy')
    expect(args[args.indexOf('-f') + 1]).toBe('mpegts')
    expect(args[args.length - 1]).toBe('pipe:1')
  })
  it('uses TCP transport and drops audio', () => {
    expect(args[args.indexOf('-rtsp_transport') + 1]).toBe('tcp')
    expect(args).toContain('-an')
  })
  it('passes the URL as a discrete argv entry (no shell interpolation)', () => {
    const evil = 'rtsp://cam/$(rm -rf /)" && echo pwned'
    expect(buildFfmpegArgs(evil)).toContain(evil)
  })
})

describe('camera tile config', () => {
  it('has a spec and survives sanitizeLayout', () => {
    expect(TILE_SPECS.camera.allowMultiple).toBe(true)
    const [tile] = sanitizeLayout([
      { id: 'c1', type: 'camera', x: 0, y: 0, w: 4, h: 3, config: { cameraId: 'cam-123' } }
    ])
    expect(tile.type).toBe('camera')
    expect(tile.config).toEqual({ cameraId: 'cam-123' })
  })
})
