// main.ts
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

const router = new Router();

// In-memory data store for demonstration
// deno-lint-ignore no-explicit-any
const topics: { id: number; name: string; data?: any }[] = [
  { id: 1, name: "Sample topic", data: { description: "A sample topic" } },
];
let nextId = 2;

// GET - Retrieve all topics or specific topic
router.get("/", (ctx) => {
  ctx.response.body = {
    message: "Hello World! Deno Oak API is running",
    endpoints: {
      "GET /": "This message",
      "GET /topics": "Get all topics",
      "GET /topics/:id": "Get specific topic",
      "POST /topics": "Create new topic",
      "PUT /topics/:id": "Update topic leaf",
      "DELETE /topics/:id": "Delete topic leaf",
      "DELETE /:id": "Delete topic",
      "DELETE /": "Delete all topics",
      "HEAD /topics": "Get topics metadata",
    },
  };
});

router.get("/topics", (ctx) => {
  ctx.response.body = { topics, total: topics.length };
});

router.get("/topics/:id", (ctx) => {
  const id = parseInt(ctx.params.id);
  const topic = topics.find((i) => i.id === id);

  if (!topic) {
    ctx.response.status = 404;
    ctx.response.body = { error: "topic not found" };
    return;
  }

  ctx.response.body = { topic };
});

// POST - Create new topic
router.post("/topics", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;

    if (!body.name) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Name is required" };
      return;
    }

    const newtopic = {
      id: nextId++,
      name: body.name,
      data: body.data || {},
    };

    topics.push(newtopic);

    ctx.response.status = 201;
    ctx.response.body = {
      message: "topic created successfully",
      topic: newtopic,
    };
  } catch (_error) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid JSON" };
  }
});

// PUT - Update existing topic
router.put("/topics/:id", async (ctx) => {
  try {
    const id = parseInt(ctx.params.id);
    const topicIndex = topics.findIndex((i) => i.id === id);

    if (topicIndex === -1) {
      ctx.response.status = 404;
      ctx.response.body = { error: "topic not found" };
      return;
    }

    const body = await ctx.request.body({ type: "json" }).value;

    // Update the topic
    topics[topicIndex] = {
      ...topics[topicIndex],
      name: body.name || topics[topicIndex].name,
      data: body.data !== undefined ? body.data : topics[topicIndex].data,
    };

    ctx.response.body = {
      message: "topic updated successfully",
      topic: topics[topicIndex],
    };
  } catch (_error) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid JSON or topic ID" };
  }
});

// DELETE - Remove topic
router.delete("/topics/:id", (ctx) => {
  const id = parseInt(ctx.params.id);
  const topicIndex = topics.findIndex((i) => i.id === id);

  if (topicIndex === -1) {
    ctx.response.status = 404;
    ctx.response.body = { error: "topic not found" };
    return;
  }

  const deletedtopic = topics.splice(topicIndex, 1)[0];

  ctx.response.body = {
    message: "topic deleted successfully",
    deletedtopic,
  };
});

// HEAD - Get metadata without body
router.head("/topics", (ctx) => {
  ctx.response.headers.set("X-Total-topics", topics.length.toString());
  ctx.response.headers.set("X-API-Version", "1.0");
  ctx.response.status = 200;
  // HEAD responses shouldn't have a body
});

// Create Oak application
const app = new Application();

// Middleware
app.use(oakCors()); // Enable CORS
app.use(router.routes());
app.use(router.allowedMethods());

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error("Error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// 404 handler
app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Route not found" };
});

const PORT = 8000;

console.log(`🚀 Server running on http://localhost:${PORT}`);
console.log(`📚 API Documentation:`);
console.log(`  GET    /              - API info`);
console.log(`  GET    /topics         - Get all topics`);
console.log(`  GET    /topics/:id     - Get topic by ID`);
console.log(`  POST   /topics         - Create new topic`);
console.log(`  PUT    /topics/:id     - Update topic`);
console.log(`  DELETE /topics/:id     - Delete topic`);
console.log(`  HEAD   /topics         - Get topics metadata`);

await app.listen({ port: PORT });
