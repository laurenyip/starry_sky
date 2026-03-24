import Link from 'next/link'

export default function ProfileNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-sm font-medium text-zinc-500">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        Profile not found
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        There is no user with that username. Usernames are case-sensitive.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        Back to home
      </Link>
    </div>
  )
}
