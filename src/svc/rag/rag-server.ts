// main.ts
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

const router = new Router();

// In-memory data store for demonstration
// deno-lint-ignore no-explicit-any
const items: { id: number; name: string; data?: any }[] = [
  { id: 1, name: "Sample Item", data: { description: "A sample item" } }
];
let nextId = 2;

// GET - Retrieve all items or specific item
router.get("/", (ctx) => {
  ctx.response.body = { 
    message: "Hello World! Deno Oak API is running",
    endpoints: {
      "GET /": "This message",
      "GET /items": "Get all items",
      "GET /items/:id": "Get specific item",
      "POST /items": "Create new item",
      "PUT /items/:id": "Update item",
      "DELETE /items/:id": "Delete item",
      "HEAD /items": "Get items metadata"
    }
  };
});

router.get("/items", (ctx) => {
  ctx.response.body = { items, total: items.length };
});

router.get("/items/:id", (ctx) => {
  const id = parseInt(ctx.params.id);
  const item = items.find(i => i.id === id);
  
  if (!item) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Item not found" };
    return;
  }
  
  ctx.response.body = { item };
});

// POST - Create new item
router.post("/items", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    
    if (!body.name) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Name is required" };
      return;
    }
    
    const newItem = {
      id: nextId++,
      name: body.name,
      data: body.data || {}
    };
    
    items.push(newItem);
    
    ctx.response.status = 201;
    ctx.response.body = { 
      message: "Item created successfully",
      item: newItem 
    };
  } catch (_error) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid JSON" };
  }
});

// PUT - Update existing item
router.put("/items/:id", async (ctx) => {
  try {
    const id = parseInt(ctx.params.id);
    const itemIndex = items.findIndex(i => i.id === id);
    
    if (itemIndex === -1) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Item not found" };
      return;
    }
    
    const body = await ctx.request.body({ type: "json" }).value;
    
    // Update the item
    items[itemIndex] = {
      ...items[itemIndex],
      name: body.name || items[itemIndex].name,
      data: body.data !== undefined ? body.data : items[itemIndex].data
    };
    
    ctx.response.body = { 
      message: "Item updated successfully",
      item: items[itemIndex] 
    };
  } catch (_error) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Invalid JSON or item ID" };
  }
});

// DELETE - Remove item
router.delete("/items/:id", (ctx) => {
  const id = parseInt(ctx.params.id);
  const itemIndex = items.findIndex(i => i.id === id);
  
  if (itemIndex === -1) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Item not found" };
    return;
  }
  
  const deletedItem = items.splice(itemIndex, 1)[0];
  
  ctx.response.body = { 
    message: "Item deleted successfully",
    deletedItem 
  };
});

// HEAD - Get metadata without body
router.head("/items", (ctx) => {
  ctx.response.headers.set("X-Total-Items", items.length.toString());
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
console.log(`  GET    /items         - Get all items`);
console.log(`  GET    /items/:id     - Get item by ID`);
console.log(`  POST   /items         - Create new item`);
console.log(`  PUT    /items/:id     - Update item`);
console.log(`  DELETE /items/:id     - Delete item`);
console.log(`  HEAD   /items         - Get items metadata`);

await app.listen({ port: PORT });