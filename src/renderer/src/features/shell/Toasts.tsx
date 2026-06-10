import { useToasts } from '../../stores/toastStore'

export function Toasts() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[70] flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className="animate-pop pointer-events-auto max-w-xl rounded-2xl bg-ink px-5 py-3 text-base font-bold text-paper shadow-float"
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
