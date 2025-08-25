// keys.ts
import { getKv } from "./kv.ts";

// Generate a random API key
function generateKey(): string {
  return crypto.randomUUID();
}

interface KeyRecord {
  created: number;
  expires: number;
  quota: number;
  used: number;
}

// Faucet: issue a new key with expiry + quota
export async function issueKey(
  ttlMs = 24 * 60 * 60 * 1000, // 24h
  quota = 1000,
): Promise<string> {
  const kv = await getKv();
  const key = generateKey();
  const now = Date.now();
  const record: KeyRecord = { created: now, expires: now + ttlMs, quota, used: 0 };
  await kv.set(["apikeys", key], record, { expireIn: ttlMs });
  return key;
}

// Validate + increment usage
export async function validateKey(key: string): Promise<boolean> {
  const kv = await getKv();
  const entry = await kv.get<KeyRecord>(["apikeys", key]);
  if (!entry.value) return false;

  const { expires, quota, used } = entry.value;
  if (Date.now() > expires) return false;
  if (used >= quota) return false;

  await kv.set(["apikeys", key], {
    ...entry.value,
    used: used + 1,
  }, { expireIn: expires - Date.now() });

  return true;
}
