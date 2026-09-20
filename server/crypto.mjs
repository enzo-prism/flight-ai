import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export const randomToken = () => randomBytes(32).toString("base64url");
export const hashToken = (value) =>
  createHash("sha256").update(value).digest("hex");
export const challenge = (value) =>
  createHash("sha256").update(value).digest("base64url");
function key(env) {
  const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("Encryption unavailable");
  return key;
}
export function encrypt(value, context, env = process.env) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(env), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decrypt(value, context, env = process.env) {
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1") throw new Error("Invalid encrypted value");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(env),
    Buffer.from(iv, "base64url"),
  );
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(data, "base64url")),
      cipher.final(),
    ]).toString("utf8"),
  );
}
export function encryptionReady(env = process.env) {
  try {
    key(env);
    return true;
  } catch {
    return false;
  }
}
