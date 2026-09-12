import { spawn } from 'node:child_process'
import { resolveFfmpegPath } from './cameraService'
import { AppError, invalid } from './errors'

/**
 * Local speech-to-text via Transformers.js (Whisper). Runs entirely in the
 * main process — no cloud calls, no API keys. The model (~40MB whisper-tiny)
 * auto-downloads from HuggingFace on first use, then runs offline from cache.
 *
 * The renderer captures mic audio with MediaRecorder (webm/opus) and sends the
 * raw bytes over IPC. We decode to 16kHz mono Float32 PCM with the bundled
 * ffmpeg-static binary, then run Whisper on the samples.
 */

// Imported lazily so the heavy WASM runtime + model only load on first use,
// not at app boot. Transformers.js is a pure-WASM dependency (no native
// binary), so it packages cleanly with electron-builder.
type Pipeline = {
  (audio: { data: Float32Array; sampling_rate: number }, opts?: { language?: string; task?: string }): Promise<{ text: string }>
}

let pipelinePromise: Promise<Pipeline> | null = null

async function loadPipeline(): Promise<Pipeline> {
  if (pipelinePromise) return pipelinePromise
  pipelinePromise = (async () => {
    const { pipeline } = await import('@huggingface/transformers')
    return (await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en')) as Pipeline
  })()
  return pipelinePromise
}

/** Decode webm/opus bytes to 16kHz mono Float32 PCM via the bundled ffmpeg. */
async function decodeToPcm16k(webm: Uint8Array): Promise<Float32Array> {
  const ffmpeg = resolveFfmpegPath()
  if (!ffmpeg) throw new AppError('FFMPEG_MISSING', 'ffmpeg binary not found — reinstall the app')

  const proc = spawn(ffmpeg, ['-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  })
  proc.stdin.write(Buffer.from(webm))
  proc.stdin.end()

  const out: Buffer[] = []
  proc.stdout.on('data', (d: Buffer) => out.push(d))
  const stderrTail: string[] = []
  proc.stderr.on('data', (d: Buffer) => {
    stderrTail.push(d.toString('utf8'))
    if (stderrTail.length > 20) stderrTail.shift()
  })

  const exitCode = await new Promise<number>((resolve) => proc.on('exit', (code) => resolve(code ?? -1)))
  if (exitCode !== 0) {
    throw new AppError('DECODE_FAILED', `Could not decode audio: ${stderrTail.join('').slice(-300)}`)
  }
  const raw = Buffer.concat(out)
  const samples = new Float32Array(raw.byteLength / 4)
  for (let i = 0; i < samples.length; i++) samples[i] = raw.readFloatLE(i * 4)
  return samples
}

/**
 * Transcribe a webm/opus mic recording. Returns the trimmed transcript, or
 * null when the model produced nothing usable.
 */
export async function transcribeAudio(webm: Uint8Array): Promise<string | null> {
  if (webm.length === 0) throw invalid('No audio captured')
  const pcm = await decodeToPcm16k(webm)
  if (pcm.length === 0) return null
  const run = await loadPipeline()
  const result = await run({ data: pcm, sampling_rate: 16_000 }, { language: 'english', task: 'transcribe' })
  const text = result.text.trim()
  return text.length > 0 ? text : null
}

export type SttService = {
  transcribe: (audio: number[]) => Promise<string | null>
}

export function createSttService(): SttService {
  return { transcribe: (audio) => transcribeAudio(new Uint8Array(audio)) }
}