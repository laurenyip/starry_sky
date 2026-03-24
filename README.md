# FriendGraph

FriendGraph is a web app for building a visual **network of people** and **how they relate** to each other. Sign in, add people and connections, explore your graph on an interactive canvas, and share a **read-only public profile** URL so others can view your graph.

## Tech stack

- **Next.js** (App Router, TypeScript)
- **Supabase** (Auth, Postgres, Row Level Security)
- **react-force-graph-2d** (2D force-directed graph)
- **Tailwind CSS** (styling)

## Run locally

1. **Clone the repository** (or download the project).

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment variables**  
   Copy `.env.example` to `.env.local` and set:

   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase → *Project Settings* → *API* → *Project URL*
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — *anon* *public* key (same page)
   - `SUPABASE_SERVICE_ROLE_KEY` — *service_role* key (server-only; needed for **public profile** pages to load other users’ graphs; never use in client-side code)
   - `NEXT_PUBLIC_SITE_URL` (optional) — e.g. `http://localhost:3000` for correct metadata in development

4. **Database**  
   In the Supabase **SQL Editor**, run the script in `supabase/schema.sql` to create tables, RLS policies, and grants. Adjust if your project already has conflicting objects.

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push the repo to GitHub (or GitLab / Bitbucket) and **import the project** in the [Vercel dashboard](https://vercel.com).

2. Under **Settings → Environment Variables**, add at least (for **Production** and **Preview** as needed):

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Without these, the site can still build, but auth and the graph will not work until they are set and you redeploy.

   For production **public profile** routes to show visitors each user’s graph, also add:

   - `SUPABASE_SERVICE_ROLE_KEY` (mark as sensitive; only used in server code)

3. Optionally set `NEXT_PUBLIC_SITE_URL` to your production URL (e.g. `https://your-app.vercel.app`) for Open Graph and `metadataBase`.

4. Deploy. Vercel detects **Next.js** automatically; **no `vercel.json` is required** for this app unless you later add redirects, headers, or other platform-specific rules.

## Security notes

- Do **not** commit `.env.local` or any file containing real keys.
- The **service role** key bypasses RLS and must only be used on the server (e.g. Vercel serverless / Route Handlers / Server Components that never embed it in client bundles).
