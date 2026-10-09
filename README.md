# GitHub Project Promotion Automation

This repository contains two separate automations:

1. **GitHub Actions draft queue** — scans public repositories and creates a reviewable draft issue daily at 09:00 IST. This workflow does not publish to social media.
2. **LinkedIn scheduled publisher** — a Vercel serverless endpoint intended to publish at most one eligible public repository per day at 09:30 IST after LinkedIn OAuth and all required Vercel environment variables are configured.

## LinkedIn publishing status and safety

The publisher is implemented in `api/linkedin/publish.js` and scheduled in `vercel.json`. Its presence in GitHub does not prove that Vercel registered the cron or that LinkedIn accepted a post. Confirm Vercel deployment status and function logs before treating publishing as operational.

The publisher can create a **public LinkedIn post**. Do not invoke the endpoint manually with the cron authorization header unless you intend to publish. Requests without the matching `Authorization: Bearer <CRON_SECRET>` are rejected.

## Required Vercel environment variables

Set these in the Vercel project for **Production**, then redeploy:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI=https://project-promo-automation.vercel.app/api/linkedin/callback`
- `LINKEDIN_VERSION=202609` (latest version shown by LinkedIn's official versioning docs as of 9 October 2026)
- `LINKEDIN_TOKEN_ENCRYPTION_KEY` (64 hexadecimal characters / 32 bytes)
- `OAUTH_STATE_SECRET` (long random secret)
- `CRON_SECRET` (long random secret; Vercel uses it to authorize cron requests)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GITHUB_USERNAME=Ansuman123580`

Official LinkedIn versioning documentation: https://learn.microsoft.com/en-us/linkedin/marketing/versioning

Never commit real secrets to GitHub or share them in screenshots.

## Schedules

- GitHub Actions draft workflow: `30 3 * * *` = 09:00 IST.
- Vercel LinkedIn publisher: `0 4 * * *` = 09:30 IST.

Vercel cron availability and registration depend on a successful production deployment and the project's Vercel plan/configuration. Verify the Cron Jobs dashboard and function logs. A green GitHub Actions run only confirms the draft workflow, not LinkedIn publishing.

## Publisher behaviour and limitations

- Publishes a plain-text post linking to one eligible public repository at a time; it does not yet create a multi-image post or a carousel.
- Skips private, forked, archived, or disabled repositories and repositories with a recorded publish key in Upstash.
- Uses a LinkedIn access token stored encrypted in Upstash Redis.
- LinkedIn tokens expire; this implementation does not automatically refresh them. Reconnect LinkedIn when the token expires.
- The demo URL is derived from repository homepage/README metadata and is not currently health-checked. Verify it before relying on it.
- If LinkedIn accepts a post but the Redis record fails, duplicate prevention may not be guaranteed on the next run.
- The endpoint returns safe error summaries; inspect Vercel function logs for diagnostics. Do not expose secrets.

## GitHub Actions draft queue

The daily draft workflow scans public, non-fork repositories and creates one copy-ready issue. It avoids duplicates and marks drafts for human review. The approval-guard workflow only comments that approval was recorded; it does not publish to LinkedIn.

## Security

- `.env` and environment files are ignored by Git; only `.env.example` is committed.
- Rotate any credential accidentally committed or shared.
- Do not test the publisher by visiting its URL in a browser with authorization; a valid request can publish publicly.
