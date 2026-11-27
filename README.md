# Butterfly

Butterfly is a 3D creative network where people make artwork in response to a starting question or to each other's work. Select a question to see its connected creations light up. Exploring is public. Publishing uses Google sign-in, and artists can optionally attach a profile to their work.

[Try Butterfly](https://butterfly-human-creativity.vercel.app)

## Run locally

1. Install Node.js 22 or later and start a PostgreSQL database.
2. Copy `server/.env.example` to `server/.env`. Set your database URL, a random session secret, `NODE_ENV=development`, and `PUBLIC_ORIGIN=http://localhost:5173`. For Google sign-in, add your own OAuth credentials and register `http://localhost:5173/api/auth/google/callback` as the callback URL.
3. In `server/`, run `npm ci` and `node --env-file=.env index.mjs`.
4. From the repository root, run `npm ci` and `npm run dev`. Open the URL printed by Vite.

Without OAuth credentials, the 64 illustrative seed nodes are still available to explore. For your own Vercel deployment, replace the example API origin in `vercel.json` and set the backend's public origin to your frontend URL.

Run `npm run build` for a production frontend build and `npm test --prefix server` for backend validation tests.

Built with React, TypeScript, Vite, Three.js, React Three Fiber, Express, PostgreSQL, and Google OAuth. The live demo uses Vercel and Railway. OpenAI Codex helped implement, debug, and test the project.
