export function LoadingSpinner({
  className = '',
  label,
}: {
  className?: string
  label?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      <svg
        className="h-5 w-5 shrink-0 animate-spin text-foreground"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label ? (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      ) : null}
    </span>
  )
}
