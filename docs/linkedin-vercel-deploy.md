# Secure LinkedIn OAuth callback on Vercel

This adds a server-side OAuth start route and callback route. The callback validates a signed, short-lived state cookie, exchanges the authorization code server-side, encrypts the access token with AES-256-GCM, and stores only the ciphertext in Upstash Redis. It never prints the access token.

## 1. Deploy the repository to Vercel

1. In Vercel, choose **Add New → Project** and import `Ansuman123580/project-promo-automation`.
2. Framework preset: **Other**. No build command is required for these API routes.
3. Deploy the project.
4. Copy the production deployment domain, for example `https://your-project.vercel.app`. Use your actual domain, not the example.

## 2. Create a Redis store

In Vercel Marketplace, add an Upstash Redis integration/store to this project. Copy its REST URL and REST token into Vercel environment variables. Keep both private.

## 3. Add Vercel environment variables

Add these under **Project → Settings → Environment Variables** for Production (and Preview only if needed):

- `LINKEDIN_CLIENT_ID` — Client ID from LinkedIn Developer Portal → Auth.
- `LINKEDIN_CLIENT_SECRET` — Primary Client Secret. Never commit or share it.
- `LINKEDIN_REDIRECT_URI` — exact value: `https://YOUR-DEPLOYMENT-DOMAIN/api/linkedin/callback`.
- `OAUTH_STATE_SECRET` — a random secret of at least 32 characters.
- `LINKEDIN_TOKEN_ENCRYPTION_KEY` — 64 hex characters (32 random bytes).
- `UPSTASH_REDIS_REST_URL` — from Upstash.
- `UPSTASH_REDIS_REST_TOKEN` — from Upstash.

Generate secrets locally on macOS Terminal without sharing them:
- State secret: `openssl rand -base64 32`
- Encryption key: `openssl rand -hex 32`

Do not use the sample domain above literally. Do not put secret values in GitHub files, Issues, chat, or screenshots.

## 4. Configure LinkedIn redirect URL

In LinkedIn Developer Portal → your app → **Auth** → edit **Authorized redirect URLs for your app**, add the exact `LINKEDIN_REDIRECT_URI` value used in Vercel. The strings must match exactly, including HTTPS, path, and trailing slash behavior (do not add a trailing slash unless it is in the environment variable).

## 5. Re-deploy and test

After environment variables are saved, redeploy the Vercel project. Open:

`https://YOUR-DEPLOYMENT-DOMAIN/api/linkedin/start`

Sign in to LinkedIn and authorize the app. A successful callback should show a confirmation page; the access token will not be displayed. If authorization fails, check Vercel function logs without copying any secrets into chat.

## Current limitations

- The callback requests only `w_member_social`, which is sufficient for the Share on LinkedIn posting permission.
- This step stores an encrypted token in Upstash Redis; it does not yet implement publishing, image uploads, member identity lookup, token renewal, or the explicit GitHub approval-to-publish bridge.
- LinkedIn access tokens are time-limited. Reauthorization/expiry handling must be implemented before relying on this in production.
- Never publish solely because a draft issue exists. The future publishing workflow must require human review, a verified live URL and images, and a separate explicit approval action.
