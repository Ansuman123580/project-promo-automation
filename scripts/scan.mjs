const owner = process.env.GITHUB_USERNAME || 'Ansuman123580';
const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const api = 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

async function gh(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${path}: ${(await response.text()).slice(0, 300)}`);
  return response.status === 204 ? null : response.json();
}

function clean(text = '') {
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function findDemoUrl(repo, readme) {
  const homepage = typeof repo.homepage === 'string' ? repo.homepage.trim() : '';
  if (/^https?:\/\//i.test(homepage) && !/localhost|127\.0\.0\.1/i.test(homepage)) return homepage;

  const markdownLinks = [...readme.matchAll(/\[[^\]]*(?:live demo|demo|website|visit|preview)[^\]]*\]\((https?:\/\/[^)]+)\)/ig)].map(m => m[1]);
  const labelledUrls = [...readme.matchAll(/(?:live demo|demo url|website|deployed at|preview)\s*[:—-]\s*(https?:\/\/[^\s)]+)/ig)].map(m => m[1]);
  const candidates = [...labelledUrls, ...markdownLinks].filter(url =>
    /^https?:\/\//i.test(url) &&
    !/localhost|127\.0\.0\.1|github\.com\/[^/]+\/[^/]+(?:\/|$)/i.test(url)
  );
  return candidates[0] || null;
}

function makeDraft(repo, readme) {
  const description = repo.description || 'A project I have been building and improving.';
  const heading = (readme.match(/^#\s+(.+)$/m) || [])[1] || repo.name;
  const sections = [...readme.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m => m[1]).filter(x => !/^(license|contributing|table of contents)$/i.test(x)).slice(0, 5);
  const bullets = sections.length
    ? sections.slice(0, 3).map(s => `- ${s}`).join('\n')
    : '- Project structure and implementation\n- A practical, hands-on build\n- Ongoing improvements';
  const demo = findDemoUrl(repo, readme);
  return `I’ve been building ${heading} — ${description}

A few things this project explores:
${bullets}

I’m sharing more of my web development work, experiments, and lessons as I build.

🔗 Repository: ${repo.html_url}
🌐 Live demo: ${demo || 'Not deployed yet — add the deployed URL to the repository About → Website field or README before publishing.'}

If you’re working on a website or digital product and need a developer, feel free to connect.

#WebDevelopment #BuildInPublic #JavaScript #FrontendDevelopment

---

**Before publishing:** verify every claim and link, add a real screenshot if available, and tailor the CTA to the project. If no deployed URL is found, the draft will clearly say so rather than inventing a link.`;
}

async function main() {
  if (!repository) throw new Error('GITHUB_REPOSITORY is required when creating a draft issue.');
  const repos = await gh(`/users/${encodeURIComponent(owner)}/repos?type=public&sort=updated&direction=desc&per_page=100`);
  const publicRepos = repos.filter(r => !r.private && !r.fork && !r.archived && !r.disabled);
  if (!publicRepos.length) {
    console.log(`No eligible public repositories found for ${owner}.`);
    return;
  }

  const issues = await gh(`/repos/${repository}/issues?state=all&per_page=100`);
  const alreadyDrafted = new Set(issues.filter(i => !i.pull_request && i.labels?.some(l => (typeof l === 'string' ? l : l.name) === 'promo-draft')).map(i => i.title));
  const candidate = publicRepos.find(r => r.full_name.toLowerCase() !== repository.toLowerCase() && !alreadyDrafted.has(`Promo draft: ${r.full_name}`));
  if (!candidate) {
    console.log('Every eligible repository already has a promo-draft issue. No duplicate created.');
    return;
  }

  let readme = '';
  try {
    const data = await gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(candidate.name)}/readme`);
    readme = data.content ? Buffer.from(data.content, 'base64').toString('utf8') : '';
  } catch (err) {
    console.log(`README unavailable for ${candidate.full_name}; using repository metadata. (${err.message})`);
  }
  for (const label of [
    { name: 'promo-draft', color: '1D76DB', description: 'Generated project promotion draft' },
    { name: 'needs-approval', color: 'FBCA04', description: 'Must be reviewed before publishing' },
    { name: 'approved', color: '0E8A16', description: 'Human approval recorded; manual publishing only' }
  ]) {
    try {
      await gh(`/repos/${repository}/labels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(label) });
    } catch (err) {
      if (!String(err.message).includes('422')) throw err;
    }
  }

  const body = [
    '## Approval required — not published',
    '',
    `**Repository:** ${candidate.html_url}`,
    `**Description:** ${candidate.description || 'No repository description set.'}`,
    `**Last updated:** ${candidate.updated_at}`,
    '',
    '### Draft post',
    '',
    makeDraft(candidate, clean(readme)),
    '',
    '### Human review checklist',
    '- [ ] Check that all statements match the actual project',
    '- [ ] Verify the live demo and repository links (if no demo URL is found, deploy the project and add its URL to the repository About → Website field or README)',
    '- [ ] Add/verify a project screenshot',
    '- [ ] Edit the draft to sound like me',
    '- [ ] Manually publish the approved text on LinkedIn or another platform',
    '',
    '**Safety rule:** applying the `approved` label does not publish anything. This MVP has no social-posting credentials and never posts automatically.'
  ].join('\n');
  const issue = await gh(`/repos/${repository}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Promo draft: ${candidate.full_name}`, body, labels: ['promo-draft', 'needs-approval'] })
  });
  console.log(`Created approval draft: ${issue.html_url}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });
