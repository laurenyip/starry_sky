import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6 sm:py-24">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Welcome
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          FriendGraph
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Map the people in your life and how they&apos;re connected. Build your
          graph, add relationships, and share a read-only public profile so
          friends can explore it too.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-center text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-900"
          >
            Log in
          </Link>
        </div>

        <p className="mt-12 text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{' '}
          <Link
            href="/dashboard"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Go to dashboard
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
