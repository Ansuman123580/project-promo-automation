import crypto from "node:crypto";

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function encrypt(plaintext, hexKey) {
  if (!/^[0-9a-f]{64}$/i.test(hexKey || "")) {
    throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes).");
  }
  const key = Buffer.from(hexKey, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: ciphertext.toString("base64url")
  });
}

async function saveEncryptedToken(encryptedToken) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) throw new Error("Upstash Redis environment variables are missing.");

  const response = await fetch(`${redisUrl.replace(/\/$/, "")}/set/linkedin:oauth-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "text/plain"
    },
    body: encryptedToken
  });

  if (!response.ok) throw new Error("Encrypted token storage failed.");
  const result = await response.json();
  if (result.error) throw new Error("Encrypted token storage failed.");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", "linkedin_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/linkedin; Max-Age=0");

  const { code, state, error } = req.query || {};
  if (error) return res.status(400).send("LinkedIn authorization was cancelled or denied. You can close this page.");
  if (typeof code !== "string" || typeof state !== "string") {
    return res.status(400).send("Missing authorization code or state. Start again from the OAuth start link.");
  }

  const stateCookie = getCookie(req, "linkedin_oauth_state");
  const [cookieState, cookieSignature] = stateCookie.split(".");
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret || !cookieState || !cookieSignature ||
      !safeEqual(state, cookieState) ||
      !safeEqual(cookieSignature, sign(cookieState, secret))) {
    return res.status(400).send("OAuth state verification failed. For your security, start authorization again.");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(503).send("LinkedIn OAuth is not fully configured. Check Vercel environment variables.");
  }

  try {
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("LinkedIn token exchange failed with status", tokenResponse.status);
      return res.status(502).send("LinkedIn token exchange failed. Check the app credentials and redirect URL, then try again.");
    }

    const encrypted = encrypt(JSON.stringify({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      saved_at: new Date().toISOString()
    }), process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY);

    await saveEncryptedToken(encrypted);
    return res.status(200).send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>LinkedIn connected</title><body style="font:16px system-ui;max-width:640px;margin:12vh auto;padding:24px;background:#0b1020;color:#f5f7ff"><h1>LinkedIn authorization successful</h1><p>Your access token was encrypted before storage. It is not displayed on this page.</p><p>Authorization is connected, but publishing is not enabled yet. Posts will remain drafts until the approval-gated publishing workflow is implemented and tested.</p></body></html>`);
  } catch (err) {
    console.error("LinkedIn OAuth callback error:", err instanceof Error ? err.message : "unknown error");
    return res.status(500).send("Could not securely save the LinkedIn authorization. Check Vercel and Upstash configuration, then retry.");
  }
}
