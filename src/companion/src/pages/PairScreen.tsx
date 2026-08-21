import { GhostButton } from '../components/ui'

export function PairScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
      <img src="/icon-192.png" alt="" className="h-20 w-20 rounded-3xl shadow-card" />
      <h1 className="font-display text-3xl font-semibold">Kitchen Skylight</h1>
      <p className="max-w-xs text-base font-semibold text-ink-soft">
        This phone isn't paired with the family display.
      </p>
      <ol className="max-w-xs list-decimal space-y-1.5 pl-5 text-left text-base font-semibold text-ink-soft">
        <li>On the display, open Settings → General</li>
        <li>
          Under <span className="font-extrabold">Companion app</span>, tap{' '}
          <span className="font-extrabold">Pair a phone</span>
        </li>
        <li>Scan the QR code with this phone's camera</li>
      </ol>
      <GhostButton onClick={onRetry}>I've scanned it — retry</GhostButton>
    </div>
  )
}
