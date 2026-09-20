import { createServerClient } from "@supabase/ssr";
import { parseCookie as parse, stringifySetCookie } from "cookie";
const serialize = (name, value, options) =>
  stringifySetCookie({ name, value, ...options });
export function serviceReady(env = process.env) {
  return Boolean(
    env.SUPABASE_URL &&
    (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY) &&
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
export function appOrigin(env = process.env) {
  const url = new URL(env.APP_ORIGIN || "https://flight-ai-two.vercel.app");
  if (
    url.protocol !== "https:" &&
    !(
      env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Invalid app origin");
  return url.origin;
}
export function sameOrigin(req, env = process.env) {
  return (
    req.headers.origin === appOrigin(env) &&
    (!req.headers["sec-fetch-site"] ||
      ["same-origin", "none"].includes(req.headers["sec-fetch-site"]))
  );
}
export function createAuth(req, res, env = process.env) {
  let jar = parse(req.headers.cookie || "");
  return createServerClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        secure: appOrigin(env).startsWith("https:"),
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll: () =>
          Object.entries(jar).map(([name, value]) => ({ name, value })),
        setAll: (updates) => {
          const existing = res.getHeader("Set-Cookie") || [];
          res.setHeader("Set-Cookie", [
            ...(Array.isArray(existing) ? existing : [existing]),
            ...updates.map(({ name, value, options }) => {
              jar[name] = value;
              return serialize(name, value, {
                ...options,
                httpOnly: true,
                secure: appOrigin(env).startsWith("https:"),
                sameSite: "lax",
                path: "/",
              });
            }),
          ]);
        },
      },
    },
  );
}
export async function authSettings(env = process.env, fetchImpl = fetch) {
  if (!serviceReady(env))
    return {
      email: false,
      google: false,
      apple: false,
      sso: false,
      verified: false,
    };
  try {
    const r = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error();
    const d = await r.json();
    return {
      email: d.external?.email === true,
      google: d.external?.google === true,
      apple: d.external?.apple === true,
      sso: Boolean(d.saml_enabled),
      verified: true,
    };
  } catch {
    return {
      email: false,
      google: false,
      apple: false,
      sso: false,
      verified: false,
    };
  }
}
