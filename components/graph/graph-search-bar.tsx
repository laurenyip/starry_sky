'use client'

type GraphSearchBarProps = {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
}

export function GraphSearchBar({
  value,
  onChange,
  placeholder = 'Search nodes by name',
  className = '',
}: GraphSearchBarProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 ${className}`}
    />
  )
}
