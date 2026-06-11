/** Pure helpers for the camera service — no Electron imports so tests can run anywhere. */

export function isValidRtspUrl(url: string): boolean {
  if (!/^rtsps?:\/\/.+/i.test(url)) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.length > 0
  } catch {
    return false
  }
}

/**
 * Remux-only pipeline: copy the camera's H.264 video into MPEG-TS on stdout.
 * No transcode = near-zero CPU. SPS/PPS repeated on keyframes so a tile can
 * join an already-running stream.
 */
export function buildFfmpegArgs(url: string): string[] {
  return [
    '-rtsp_transport', 'tcp',
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-i', url,
    '-map', '0:v:0',
    '-c:v', 'copy',
    '-bsf:v', 'dump_extra=freq=keyframe',
    '-an',
    '-f', 'mpegts',
    '-mpegts_flags', 'resend_headers',
    'pipe:1'
  ]
}
