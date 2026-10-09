# LinkedIn personal-profile publishing setup

This integration is intentionally approval-gated. It must never publish a post merely because a draft was generated.

## Important format note

For organic posts on a personal LinkedIn profile, use the official Posts API with **MultiImage** content. LinkedIn's API documentation distinguishes organic MultiImage posts from sponsored Carousel posts; a true Carousel API post is not the same as an organic multi-image post.

Official references:
- Share on LinkedIn / API access: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- Images API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api

## Step 1 — Create the LinkedIn developer app

1. Open https://www.linkedin.com/developers/ and sign in.
2. Select **Create app**.
3. Enter an app name such as `AP Designs Project Promoter`.
4. Add an associated LinkedIn Page if the portal requires one for app creation. This does not change the intended post author: the integration target is your personal member profile.
5. In the app's **Products** tab, request/enable **Share on LinkedIn**.
6. In **Auth**, note the Client ID and Client Secret. Never commit these values to a file or send them in chat.
7. Complete any app verification steps shown by LinkedIn.

Share on LinkedIn provides the `w_member_social` permission for creating posts on behalf of the authenticated member. LinkedIn controls whether the product/permission is available to the app.

## Step 2 — OAuth authorization

The member must authorize the app with the `w_member_social` scope. OAuth access tokens expire; a durable integration needs a safe authorization/callback flow and token refresh/re-authorization handling. Do not paste tokens into issues, commits, screenshots, or chat.

The current GitHub Actions draft workflow does not yet obtain OAuth tokens and does not publish to LinkedIn. Do not add a publish token until an OAuth callback flow has been implemented and tested.

## Step 3 — GitHub Actions secrets

After a secure OAuth callback/token flow has been implemented, store credentials in:
**GitHub repository → Settings → Secrets and variables → Actions**.

Expected secrets/configuration (names are placeholders until the OAuth flow is implemented):
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_ACCESS_TOKEN` (secret; short-lived unless refreshed/re-authorized)
- `LINKEDIN_MEMBER_URN` (member URN obtained through the authorized identity endpoint; do not guess it)
- `LINKEDIN_VERSION` (supported API version in YYYYMM format)

Never put real values in repository files, GitHub Issues, workflow logs, or the browser.

## Step 4 — Required approval gate

Publishing implementation must:
1. Read a draft issue labelled `promo-draft` and `needs-approval`.
2. Require a human to review the caption, verified live-demo URL, image order, and image alt text.
3. Require an explicit `approved` label and a separate manual workflow dispatch confirmation before any network call that creates a post.
4. Reject drafts that have no verified public HTTPS demo URL, contain placeholder URLs, or lack approved images.
5. Upload each approved image using LinkedIn's Images API, then create the organic multi-image post using the returned image URNs and Posts API.
6. Save the returned post ID/URL and mark the issue as published only after LinkedIn confirms success.
7. Never automatically re-try a post-create request if the response is ambiguous, because that can create duplicates.

## Current status

- GitHub repository scanning and draft issue generation: implemented.
- Human approval labels: implemented.
- LinkedIn developer app: not created yet.
- OAuth callback/token handling: not implemented.
- Image upload and organic multi-image post publishing: not implemented.
- Automatic publishing: disabled until the above is configured and tested.

The next action is to create the LinkedIn developer app and enable **Share on LinkedIn**. Then continue with the OAuth callback implementation; do not create or expose any token yet.
