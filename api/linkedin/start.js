import crypto from "node:crypto";

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const stateSecret = process.env.OAUTH_STATE_SECRET;

  if (!clientId || !redirectUri || !stateSecret) {
    return res.status(503).send("LinkedIn OAuth is not configured yet. Set the required Vercel environment variables.");
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const signedState = `${state}.${sign(state, stateSecret)}`;

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", `linkedin_oauth_state=${signedState}; HttpOnly; Secure; SameSite=Lax; Path=/api/linkedin; Max-Age=600`);

  const authorize = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("scope", "openid profile email w_member_social");

  return res.redirect(302, authorize.toString());
}
