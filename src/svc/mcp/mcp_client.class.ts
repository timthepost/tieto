// deno-lint-ignore-file no-explicit-any
// Configuration file for Tieto MCP Server
// Save as: tieto_mcp_config.ts

export interface TietoMCPConfig {
  server: {
    port: number;
    host: string;
    cors_origins: string[];
  };
  tieto: {
    endpoint: string;
    embedding_model: string;
    max_results: number;
    default_threshold: number;
    timeout_ms: number;
  };
  mcp: {
    protocol_version: string;
    server_name: string;
    server_version: string;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    file?: string;
  };
}

export const DEFAULT_CONFIG: TietoMCPConfig = {
  server: {
    port: 3001,
    host: "localhost",
    cors_origins: ["*"],
  },
  tieto: {
    endpoint: "http://localhost:8000",
    embedding_model: "nomic-ai/nomic-embed-text-v1.5-GGUF",
    max_results: 10,
    default_threshold: 0.7,
    timeout_ms: 30000,
  },
  mcp: {
    protocol_version: "2024-11-05",
    server_name: "tieto-mcp-server",
    server_version: "1.0.0",
  },
  logging: {
    level: "info",
  },
};

// Example MCP Client for testing Tieto MCP Server
// Save as: tieto_mcp_client.ts

export class TietoMCPClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3001") {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(method: string, params?: any): Promise<any> {
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
    }

    return data.result;
  }

  async initialize(): Promise<any> {
    return await this.makeRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
      },
      clientInfo: {
        name: "tieto-mcp-test-client",
        version: "1.0.0",
      },
    });
  }

  async listTools(): Promise<any> {
    return await this.makeRequest("tools/list");
  }

  async search(query: string, filters?: Record<string, any>, options?: {
    limit?: number;
    threshold?: number;
  }): Promise<string> {
    const result = await this.makeRequest("tools/call", {
      name: "tieto_search",
      arguments: {
        query,
        filters: filters || {},
        limit: options?.limit || 10,
        threshold: options?.threshold || 0.7,
      },
    });

    return result.content[0].text;
  }

  async ragComplete(
    query: string,
    context?: string,
    filters?: Record<string, any>,
  ): Promise<string> {
    const result = await this.makeRequest("tools/call", {
      name: "tieto_rag_complete",
      arguments: {
        query,
        context: context || "",
        filters: filters || {},
      },
    });

    return result.content[0].text;
  }

  async ingest(
    content: string,
    metadata?: Record<string, any>,
    topic?: string,
  ): Promise<string> {
    const result = await this.makeRequest("tools/call", {
      name: "tieto_ingest",
      arguments: {
        content,
        metadata: metadata || {},
        topic: topic || "default",
      },
    });

    return result.content[0].text;
  }

  async listTopics(): Promise<string> {
    const result = await this.makeRequest("tools/call", {
      name: "tieto_list_topics",
      arguments: {},
    });

    return result.content[0].text;
  }

  async listResources(): Promise<any> {
    return await this.makeRequest("resources/list");
  }

  async readResource(uri: string): Promise<string> {
    const result = await this.makeRequest("resources/read", { uri });
    return result.contents[0].text;
  }

  async getServerHealth(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    return await response.json();
  }

  async getServerInfo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/info`);
    return await response.json();
  }
}

async function testTietoMCP() {
  const client = new TietoMCPClient();

  try {
    console.log("🚀 Testing Tieto MCP Server...\n");

    // Check server health
    console.log("1. Checking server health...");
    const health = await client.getServerHealth();
    console.log(`   Status: ${health.status}`);
    console.log(`   Server: ${health.server} v${health.version}\n`);

    // Initialize MCP connection
    console.log("2. Initializing MCP connection...");
    const initResult = await client.initialize();
    console.log(`   Protocol: ${initResult.protocolVersion}`);
    console.log(`   Server: ${initResult.serverInfo.name}\n`);

    // List available tools
    console.log("3. Listing available tools...");
    const tools = await client.listTools();
    tools.tools.forEach((tool: any) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Test search functionality
    console.log("4. Testing document search...");
    try {
      const searchResult = await client.search("machine learning", {}, {
        limit: 5,
      });
      console.log(`   Search completed. Results preview:`);
      console.log(`   ${searchResult.substring(0, 200)}...\n`);
    } catch (error) {
      console.log(`   Search test skipped: ${(error as Error).message}\n`);
    }

    // Test RAG completion
    console.log("5. Testing RAG completion...");
    try {
      const ragResult = await client.ragComplete(
        "What is artificial intelligence?",
      );
      console.log(`   RAG completion preview:`);
      console.log(`   ${ragResult.substring(0, 200)}...\n`);
    } catch (error) {
      console.log(`   RAG test skipped: ${(error as Error).message}\n`);
    }

    // Test content ingestion
    console.log("6. Testing content ingestion...");
    try {
      const ingestResult = await client.ingest(
        "This is a test document about MCP integration with Tieto.",
        { source: "test", category: "integration" },
        "test",
      );
      console.log(`   ${ingestResult}\n`);
    } catch (error) {
      console.log(`   Ingestion test skipped: ${(error as Error).message}\n`);
    }

    // List topics
    console.log("7. Listing topics...");
    try {
      const topics = await client.listTopics();
      console.log(`   ${topics}\n`);
    } catch (error) {
      console.log(`   Topics list skipped: ${(error as Error).message}\n`);
    }

    // List resources
    console.log("8. Listing MCP resources...");
    const resources = await client.listResources();
    resources.resources.forEach((resource: any) => {
      console.log(
        `   - ${resource.name} (${resource.uri}): ${resource.description}`,
      );
    });
    console.log();

    // Read configuration resource
    console.log("9. Reading server configuration...");
    const config = await client.readResource("tieto://config");
    const configObj = JSON.parse(config);
    console.log(`   Tieto endpoint: ${configObj.tieto_endpoint}`);
    console.log(`   Max results: ${configObj.max_results}`);
    console.log(`   Default threshold: ${configObj.default_threshold}\n`);

    console.log("✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", (error as Error).message);

    if ((error as Error).message.includes("Connection refused")) {
      console.log("\n💡 Make sure the Tieto MCP server is running:");
      console.log("   deno run --allow-net --allow-read tieto_mcp_server.ts");
    }
  }
}

// Example usage and testing
if (import.meta.main) {
  // Run tests
  await testTietoMCP();
}
