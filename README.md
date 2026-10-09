# GitHub Project Promotion Automation (MVP)

A free GitHub Actions workflow that scans **public, non-fork repositories** for `Ansuman123580` and opens one copy-ready promotion draft per day as a GitHub Issue. Every draft is marked `needs-approval`. It does **not** publish automatically; manual human review and publishing are mandatory in this MVP.

## What it does

- Runs daily at 09:00 India Standard Time (03:30 UTC), or manually via Actions → Daily project promo draft → Run workflow.
- Reads public repository metadata and tries to read its README.
- Creates one `Promo draft: owner/repo` issue with labels `promo-draft` and `needs-approval`.
- Avoids creating another issue for a repository that already has a promo-draft issue, including closed issues.
- Adds a review checklist and clearly marks the text as unpublished.
- When you apply the `approved` label, a guard workflow comments that approval is recorded; it does not publish anything.

## Setup

1. This repository is intended to be a dedicated public automation repo; the MVP itself does not need a dashboard.
2. Confirm the files `.github/workflows/` and `scripts/` are in the repository root.
3. Open **Settings → Actions → General → Workflow permissions**. Enable read and write permissions if your account policy requires it. The workflow declares only `issues: write` and `contents: read`.
4. Open **Actions** and enable workflows if prompted.
5. Run **Daily project promo draft → Run workflow** once to test it. Check the Issues tab for a `Promo draft: Ansuman123580/repository-name` issue.
6. The scheduled run is daily at 09:00 IST. GitHub scheduled workflows can be delayed during high load and are based on the default branch.

## Approval process

1. Review the generated issue and correct all inaccurate or generic wording.
2. Verify demo and repository links. Add a screenshot manually where possible.
3. When ready, add the `approved` label. The guard only records the approval in a comment.
4. Copy the reviewed draft and manually publish it on LinkedIn (or another platform).
5. Optionally add `published` and record the published post URL in a comment.

**Important:** approval is a human review checkpoint, not a social-platform publishing integration. No social tokens are requested or stored. Automatic publishing is intentionally absent until official API access and an additional explicit publishing workflow are configured.

## Limitations

- This version uses deterministic templates, not an AI API, to keep costs at ₹0.
- It scans up to 100 repositories and creates one draft per run. If all are already drafted, it reports that no duplicate was created.
- It uses this automation repository's Issues tab as the queue.
- It does not fetch social analytics automatically. Track post URL, impressions, reactions, profile visits, clicks, and qualified enquiries in a simple spreadsheet at first.
- Do not commit API tokens or secrets to files. The built-in `GITHUB_TOKEN` is supplied by GitHub Actions.
