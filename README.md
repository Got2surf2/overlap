# Overlap

A simple scheduling-poll tool: propose some dates, share one link, see who's free when.

Real app, not a Claude artifact — this fixes the two things the artifact
version couldn't do:
- **True one-click links.** `/poll/ABC123` is a real page route, not a query
  string that can get stripped. Anyone who clicks it lands directly on that
  poll.
- **Server-enforced passcodes.** The create passcode and each poll's manage
  passcode are checked inside serverless functions, using your database
  connection string. Neither is ever present in code the browser can see.

Stack: Next.js (frontend + API routes) + Neon (free-tier serverless
Postgres), deployed on Vercel (free tier). No cost at this scale.

## Deploy — about 10 minutes, no credit card required

### 1. Create a free Neon project
1. Go to [neon.tech](https://neon.tech), sign up, and create a new project (any name/region, free tier).
2. Once it's ready, open the **SQL Editor** in the Neon dashboard.
3. Paste the contents of `schema.sql` (in this folder) and run it. This creates the two tables the app needs.
4. Go to your project's **Connection Details** (dashboard home, or Settings). Copy the **pooled connection string** — it looks like `postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require`. You'll need this in step 3 below.

### 2. Push this code to GitHub
1. Create a new (private is fine) GitHub repository.
2. Upload this whole folder to it — either drag-and-drop on github.com, or:
   ```
   git init
   git add .
   git commit -m "Overlap poll tool"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

### 3. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com), sign up with your GitHub account (free).
2. Click **Add New → Project**, and import the repo you just pushed.
3. Before deploying, expand **Environment Variables** and add two:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the pooled connection string from step 1.4 |
   | `CREATE_PASSCODE` | whatever passcode you want to require for creating polls |
4. Click **Deploy**. In about a minute you'll get a live URL like `https://overlap-poll.vercel.app`.

That URL is your app. `https://overlap-poll.vercel.app/create` makes a poll;
after creating one you land on `https://overlap-poll.vercel.app/poll/ABC123`
— that exact page URL is what you paste into a group chat. One click, no
code entry, works for anyone, no account needed on their end.

## Changing the create passcode later
Vercel → your project → **Settings → Environment Variables** → edit
`CREATE_PASSCODE` → redeploy (Vercel prompts you, or push any commit).

## Local development (optional)
```
npm install
cp .env.example .env.local   # fill in your real DATABASE_URL
npm run dev
```
Open http://localhost:3000.

## What's genuinely free here
- Vercel free (Hobby) tier: fine for this traffic level.
- Neon free tier: generous, and (unlike a lot of hosted Postgres free
  tiers) lets you run several small projects side by side if you ever want
  to reuse this pattern elsewhere.
- No usage-based billing kicks in unless you're at a scale far beyond a
  scheduling poll for a group.
