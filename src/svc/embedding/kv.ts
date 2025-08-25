// kv.ts
const _PROD = Deno.env.get("PROD") === "true";
let kv: Deno.Kv | null = null;

export async function getKv() {
  if (!kv) {
    if (_PROD) {
      kv = await Deno.openKv(); // cloud KV
    } else {
      kv = await Deno.openKv("db/dev.db.sqlite"); // sqlite fallback
    }
  }
  return kv;
}
