// deno-lint-ignore-file no-explicit-any
// Tieto MCP Server - Model Context Protocol implementation for Tieto RAG server
// This server exposes Tieto's retrieval and RAG capabilities via MCP
// Requires a RAG endpoint that I'm not yet done hammering out. Just a shell right now.

import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

// Tieto Integration Types
interface TietoQuery {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  threshold?: number;
}

interface TietoResult {
  content: string;
  metadata?: Record<string, any>;
  score: number;
  chunk_id: string;
}

interface TietoResponse {
  results: TietoResult[];
  query: string;
  total_results: number;
}

// MCP Server Configuration
interface MCPServerConfig {
  name: string;
  version: string;
  port: number;
  tieto_endpoint?: string;
  embedding_model?: string;
  max_results?: number;
  default_threshold?: number;
}

class TietoMCPServer {
  private app: Application;
  private router: Router;
  private config: MCPServerConfig;

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = {
      name: "tieto-mcp-server",
      version: "1.0.0",
      port: 0,
      tieto_endpoint: "http://localhost:8000",
      embedding_model: "nomic-ai/nomic-embed-text-v1.5-GGUF",
      max_results: 10,
      default_threshold: 0.7,
      ...config,
    };

    this.app = new Application();
    this.router = new Router();
    this.setupRoutes();
    this.setupMiddleware();
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;

    if (typeof error === "string") return error;

    if (error && typeof error === "object" && "message" in error) {
      return String(error.message);
    }

    return "Unknown error occurred";
  }

  private setupMiddleware() {
    // Enable CORS for MCP clients
    this.app.use(oakCors({
      origin: "*",
      allowedHeaders: ["Content-Type", "Authorization"],
    }));

    // Request logging
    this.app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      console.log(`${ctx.request.method} ${ctx.request.url} - ${ms}ms`);
    });

    // Error handling
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err) {
        console.error("Server error:", err);
        ctx.response.status = 500;

        let requestId = 1;
        try {
          const body = ctx.request.body();
          const bodyValue = await body.value;
          requestId = bodyValue?.id || 1;
        } catch {
          // Ignore body parsing errors, use default ID
        }

        ctx.response.body = this.createErrorResponse(
          requestId,
          -32603,
          "Internal error",
          (err as Error).message,
        );
      }
    });

    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());
  }

  private setupRoutes() {
    // MCP endpoint - handles all MCP protocol messages
    this.router.post("/mcp", async (ctx) => {
      const body = await ctx.request.body().value;
      const response = await this.handleMCPRequest(body);

      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = response;
    });

    // Health check endpoint
    this.router.get("/health", (ctx) => {
      ctx.response.body = {
        status: "healthy",
        server: this.config.name,
        version: this.config.version,
        timestamp: new Date().toISOString(),
      };
    });

    // Server info endpoint
    this.router.get("/info", (ctx) => {
      ctx.response.body = {
        server: this.config,
        capabilities: this.getServerCapabilities(),
        tools: this.getAvailableTools(),
      };
    });
  }

  private async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);

        case "tools/list":
          return this.handleToolsList(request);

        case "tools/call":
          return await this.handleToolCall(request);

        case "resources/list":
          return this.handleResourcesList(request);

        case "resources/read":
          return await this.handleResourceRead(request);

        default:
          return this.createErrorResponse(
            request.id,
            -32601,
            "Method not found",
            `Unknown method: ${request.method}`,
          );
      }
    } catch (error: unknown) {
      return this.createErrorResponse(
        request.id,
        -32603,
        "Internal error",
        this.safeErrorMessage(error),
      );
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: this.getServerCapabilities(),
        serverInfo: {
          name: this.config.name,
          version: this.config.version,
          description:
            "MCP Server for Tieto RAG system - provides document retrieval and completion capabilities",
        },
      },
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: this.getAvailableTools(),
      },
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "tieto_search":
        return await this.handleTietoSearch(request.id, args);

      case "tieto_rag_complete":
        return await this.handleTietoRAGComplete(request.id, args);

      case "tieto_ingest":
        return await this.handleTietoIngest(request.id, args);

      case "tieto_list_topics":
        return await this.handleTietoListTopics(request.id, args);

      default:
        return this.createErrorResponse(
          request.id,
          -32601,
          "Tool not found",
          `Unknown tool: ${name}`,
        );
    }
  }

  private async handleTietoSearch(
    id: string | number,
    args: any,
  ): Promise<MCPResponse> {
    try {
      const { query, filters, limit, threshold } = args;

      if (!query || typeof query !== "string") {
        return this.createErrorResponse(
          id,
          -32602,
          "Invalid params",
          "Query is required and must be a string",
        );
      }

      const searchParams: TietoQuery = {
        query,
        filters: filters || {},
        limit: limit || this.config.max_results,
        threshold: threshold || this.config.default_threshold,
      };

      // Call Tieto's search endpoint
      const response = await this.callTietoAPI("/search", searchParams);

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: this.formatSearchResults(response),
          }],
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        id,
        -32603,
        "Search failed",
        this.safeErrorMessage(error),
      );
    }
  }

  private async handleTietoRAGComplete(
    id: string | number,
    args: any,
  ): Promise<MCPResponse> {
    try {
      const { query, context, filters, limit } = args;

      if (!query || typeof query !== "string") {
        return this.createErrorResponse(
          id,
          -32602,
          "Invalid params",
          "Query is required and must be a string",
        );
      }

      const ragParams = {
        query,
        context: context || "",
        filters: filters || {},
        limit: limit || this.config.max_results,
        mode: "completion",
      };

      // Call Tieto's RAG completion endpoint
      const response = await this.callTietoAPI("/complete", ragParams);

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: response.completion || response.answer ||
              "No completion generated",
          }],
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        id,
        -32603,
        "RAG completion failed",
        this.safeErrorMessage(error),
      );
    }
  }

  private async handleTietoIngest(
    id: string | number,
    args: any,
  ): Promise<MCPResponse> {
    try {
      const { content, metadata, topic } = args;

      if (!content || typeof content !== "string") {
        return this.createErrorResponse(
          id,
          -32602,
          "Invalid params",
          "Content is required and must be a string",
        );
      }

      const ingestParams = {
        content,
        metadata: metadata || {},
        topic: topic || "default",
      };

      // Call Tieto's ingest endpoint
      const response = await this.callTietoAPI("/ingest", ingestParams);

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: `Successfully ingested content. Document ID: ${
              response.document_id || "unknown"
            }`,
          }],
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        id,
        -32603,
        "Ingestion failed",
        this.safeErrorMessage(error),
      );
    }
  }

  private async handleTietoListTopics(
    id: string | number,
    _args: any,
  ): Promise<MCPResponse> {
    try {
      // Call Tieto's topics endpoint
      const response = await this.callTietoAPI("/topics", {});

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: this.formatTopicsList(response),
          }],
        },
      };
    } catch (error) {
      return this.createErrorResponse(
        id,
        -32603,
        "Failed to list topics",
        this.safeErrorMessage(error),
      );
    }
  }

  private handleResourcesList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        resources: [
          {
            uri: "tieto://config",
            name: "Tieto Configuration",
            description: "Current Tieto server configuration and status",
            mimeType: "application/json",
          },
          {
            uri: "tieto://stats",
            name: "Tieto Statistics",
            description: "Usage statistics and performance metrics",
            mimeType: "application/json",
          },
        ],
      },
    };
  }

  private async handleResourceRead(request: MCPRequest): Promise<MCPResponse> {
    const { uri } = request.params;

    try {
      switch (uri) {
        case "tieto://config":
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              contents: [{
                uri,
                mimeType: "application/json",
                text: JSON.stringify(this.config, null, 2),
              }],
            },
          };

        // deno-lint-ignore no-case-declarations
        case "tieto://stats":
          const stats = await this.getTietoStats();
          return {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              contents: [{
                uri,
                mimeType: "application/json",
                text: JSON.stringify(stats, null, 2),
              }],
            },
          };

        default:
          return this.createErrorResponse(
            request.id,
            -32601,
            "Resource not found",
            `Unknown resource: ${uri}`,
          );
      }
    } catch (error) {
      return this.createErrorResponse(
        request.id,
        -32603,
        "Failed to read resource",
        this.safeErrorMessage(error),
      );
    }
  }

  private async callTietoAPI(endpoint: string, data: any): Promise<any> {
    const url = `${this.config.tieto_endpoint}${endpoint}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(
        `Tieto API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  private async getTietoStats(): Promise<any> {
    try {
      const response = await this.callTietoAPI("/stats", {});
      return response;
    } catch (error) {
      return {
        error: "Failed to retrieve stats",
        message: this.safeErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  private formatSearchResults(response: TietoResponse): string {
    const { results, query, total_results } = response;

    let formatted = `Search results for query: "${query}"\n`;
    formatted += `Found ${total_results} total results\n\n`;

    results.forEach((result, index) => {
      formatted += `--- Result ${index + 1} (Score: ${
        result.score.toFixed(3)
      }) ---\n`;
      formatted += `${result.content}\n`;

      if (result.metadata && Object.keys(result.metadata).length > 0) {
        formatted += `Metadata: ${JSON.stringify(result.metadata)}\n`;
      }

      formatted += `\n`;
    });

    return formatted;
  }

  private formatTopicsList(response: any): string {
    if (!response.topics || !Array.isArray(response.topics)) {
      return "No topics found or invalid response format";
    }

    let formatted = "Available Topics:\n\n";
    response.topics.forEach((topic: any) => {
      formatted += `- ${topic.name || topic}\n`;
      if (topic.description) {
        formatted += `  ${topic.description}\n`;
      }
      if (topic.document_count) {
        formatted += `  Documents: ${topic.document_count}\n`;
      }
      formatted += `\n`;
    });

    return formatted;
  }

  private getServerCapabilities() {
    return {
      tools: {},
      resources: {},
    };
  }

  private getAvailableTools() {
    return [
      {
        name: "tieto_search",
        description:
          "Search documents in the Tieto knowledge base using semantic similarity",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to find relevant documents",
            },
            filters: {
              type: "object",
              description: "Optional metadata filters to narrow search results",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 10)",
            },
            threshold: {
              type: "number",
              description:
                "Minimum similarity threshold for results (default: 0.7)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "tieto_rag_complete",
        description:
          "Generate a completion using RAG (Retrieval-Augmented Generation) with Tieto",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The question or prompt for RAG completion",
            },
            context: {
              type: "string",
              description: "Additional context to include in the completion",
            },
            filters: {
              type: "object",
              description: "Optional metadata filters for document retrieval",
            },
            limit: {
              type: "number",
              description:
                "Maximum number of documents to retrieve for context",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "tieto_ingest",
        description: "Ingest new content into the Tieto knowledge base",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The text content to ingest",
            },
            metadata: {
              type: "object",
              description: "Optional metadata to associate with the content",
            },
            topic: {
              type: "string",
              description:
                "Topic/category for the content (default: 'default')",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "tieto_list_topics",
        description:
          "List all available topics/categories in the Tieto knowledge base",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];
  }

  private createErrorResponse(
    id: string | number,
    code: number,
    message: string,
    data?: any,
  ): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  public async start(port: number = 3001) {
    console.log(`Starting Tieto MCP Server on port ${port}`);
    console.log(`Tieto endpoint: ${this.config.tieto_endpoint}`);
    console.log(`Available at: http://localhost:${port}/mcp`);

    await this.app.listen({ port });
  }
}

// CLI entry point
if (import.meta.main) {
  const config: Partial<MCPServerConfig> = {};

  // Parse command line arguments
  const args = Deno.args;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      // deno-lint-ignore no-case-declarations
      case "--port":
        const port = parseInt(args[++i]);
        if (port) config.port = port;
        break;
      case "--tieto-endpoint":
        config.tieto_endpoint = args[++i];
        break;
      // deno-lint-ignore no-case-declarations
      case "--max-results":
        const maxResults = parseInt(args[++i]);
        if (maxResults) config.max_results = maxResults;
        break;
      // deno-lint-ignore no-case-declarations
      case "--threshold":
        const threshold = parseFloat(args[++i]);
        if (threshold) config.default_threshold = threshold;
        break;
      case "--help":
        console.log(`
Tieto MCP Server - Model Context Protocol implementation for Tieto RAG

Usage: deno run --allow-net --allow-read tieto_mcp_server.ts [options]

Options:
  --port <number>           Port to listen on (default: 3001)
  --tieto-endpoint <url>    Tieto server endpoint (default: http://localhost:8000)
  --max-results <number>    Maximum search results (default: 10)
  --threshold <number>      Default similarity threshold (default: 0.7)
  --help                   Show this help message

Example:
  deno run --allow-net --allow-read tieto_mcp_server.ts --port 3001 --tieto-endpoint http://localhost:8000
        `);
        Deno.exit(0);
        break;
    }
  }

  const server = new TietoMCPServer(config);
  const port = (config as any).port || 3001;

  try {
    await server.start(port);
  } catch (error) {
    console.error("Failed to start server:", error);
    Deno.exit(1);
  }
}
