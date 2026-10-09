import crypto from "node:crypto";

const API = "https://api.linkedin.com/rest/posts";
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error("Upstash Redis is not configured.");
  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error("Redis request failed.");
  const result = await response.json();
  if (result.error) throw new Error("Redis request failed.");
  return result.result;
}

function decrypt(payload, hexKey) {
  if (!/^[0-9a-f]{64}$/i.test(hexKey || "")) throw new Error("Token encryption key is not configured.");
  const parsed = JSON.parse(payload);
  if (parsed.v !== 1) throw new Error("Unsupported encrypted token format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(hexKey, "hex"), Buffer.from(parsed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parsed.data, "base64url")), decipher.final()]).toString("utf8");
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}).`);
  return response.json();
}

function demoUrl(repo, readme) {
  if (/^https?:\/\//i.test(repo.homepage || "") && !/localhost|127\.0\.0\.1/i.test(repo.homepage)) return repo.homepage;
  const match = readme.match(/\[[^\]]*(?:live demo|demo|website|preview)[^\]]*\]\((https?:\/\/[^)]+)\)/i)
    || readme.match(/(?:live demo|demo url|website|deployed at|preview)\s*[:—-]\s*(https?:\/\/[^\s)]+)/i);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || "";
  if (!expected || authorization !== `Bearer ${expected}`) return res.status(401).json({ error: "Unauthorized" });

  try {
    const encrypted = await redis(["GET", "linkedin:oauth-token"]);
    if (!encrypted) return res.status(503).json({ error: "LinkedIn is not connected. Reconnect the account first." });
    const auth = JSON.parse(decrypt(encrypted, process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY));
    if (!auth.access_token || !auth.member?.urn) throw new Error("Stored LinkedIn connection is incomplete.");
    if (auth.expires_in && auth.saved_at && Date.now() > new Date(auth.saved_at).getTime() + auth.expires_in * 1000) {
      return res.status(401).json({ error: "LinkedIn access token expired. Reconnect LinkedIn." });
    }

    const owner = process.env.GITHUB_USERNAME || "Ansuman123580";
    const repos = await github(`/users/${encodeURIComponent(owner)}/repos?type=public&sort=updated&direction=desc&per_page=100`);
    const eligible = repos.filter(r => !r.private && !r.fork && !r.archived && !r.disabled && r.full_name.toLowerCase() !== `${owner}/project-promo-automation`.toLowerCase());
    let chosen = null;
    let readme = "";
    let demo = null;
    for (const repo of eligible) {
      const already = await redis(["GET", `linkedin:published:${repo.full_name.toLowerCase()}`]);
      if (already) continue;
      let candidateReadme = "";
      try {
        const r = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/readme`);
        if (r.content) candidateReadme = Buffer.from(r.content, "base64").toString("utf8");
      } catch {}
      const candidateDemo = demoUrl(repo, candidateReadme);
      if (!candidateDemo) continue;
      try {
        const check = await fetch(candidateDemo, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
        if (!check.ok || !/^https?:$/.test(new URL(check.url).protocol)) continue;
        const type = check.headers.get("content-type") || "";
        if (type && !/(text\/html|application\/xhtml\+xml)/i.test(type)) continue;
      } catch { continue; }
      chosen = repo;
      readme = candidateReadme;
      demo = candidateDemo;
      break;
    }
    if (!chosen) return res.status(200).json({ ok: true, published: false, message: "No unpublished repository with a reachable live demo URL found. Add a working URL to the repository homepage or README." });

    /* selected repository and its reachable demo are now verified */
    const heading = (readme.match(/^#\s+(.+)$/m) || [])[1] || chosen.name;
    const description = chosen.description || "A web development project I have been building.";
    const text = [
      `Building and sharing ${heading} — ${description}`,
      "",
      "I’m sharing my work in public and learning by shipping real projects.",
      "",
      `GitHub: ${chosen.html_url}`,
      ...(demo ? [`Live demo: ${demo}`] : []),
      "",
      "If your business needs a website or a frontend developer for a project, feel free to connect.",
      "",
      "#WebDevelopment #BuildInPublic #FrontendDevelopment"
    ].join("\n");

    const version = process.env.LINKEDIN_VERSION;
    if (!/^\d{6}$/.test(version || "")) return res.status(503).json({ error: "Set LINKEDIN_VERSION as a YYYYMM value in Vercel." });
    const response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
        "Linkedin-Version": version,
        "X-Restli-Protocol-Version": "2.0.0"
      },
      body: JSON.stringify({
        author: auth.member.urn,
        commentary: text,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
      })
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error("LinkedIn post failed", response.status, detail);
      return res.status(502).json({ error: `LinkedIn rejected the post (HTTP ${response.status}). Check API version and permissions.` });
    }
    const postId = response.headers.get("x-restli-id") || "created";
    await redis(["SET", `linkedin:published:${chosen.full_name.toLowerCase()}`, JSON.stringify({ postId, publishedAt: new Date().toISOString() })]);
    return res.status(200).json({ ok: true, published: true, repository: chosen.full_name, postId });
  } catch (error) {
    console.error("Scheduled LinkedIn publisher failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Publishing failed. Check Vercel function logs for the safe error summary." });
  }
}
