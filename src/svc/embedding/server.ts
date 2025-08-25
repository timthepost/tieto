// server.ts
import {
  Application,
  Router,
  type RouterContext,
} from "https://deno.land/x/oak@v12.6.0/mod.ts";
import { issueKey } from "./keys.ts";

const router = new Router();

// Faucet: anyone can request a temporary API key
router.get("/faucet", async (ctx: RouterContext<"/faucet">) => {
  const key = await issueKey();
  ctx.response.type = "application/json";
  ctx.response.body = { key, quota: 1000, ttl_hours: 24 };
});

// Proxy embedding requests to llama-server
router.post("/embed", async (ctx: RouterContext<"/embed">) => {
  const body = await ctx.request.body({ type: "text" }).value;

  const llamaResp = await fetch("http://127.0.0.1:8080/embedding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  ctx.response.status = llamaResp.status;
  ctx.response.type = "application/json";
  ctx.response.body = await llamaResp.text();
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

console.log("Listening on http://127.0.0.1:8000");
await app.listen({ port: 8000 });
