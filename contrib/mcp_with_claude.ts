// Advanced MCP Client with Claude Integration
export class AdvancedTietoMCPClient extends TietoMCPClient {
  private sessionHistory: Array<{
    timestamp: Date;
    type: "search" | "rag" | "ingest";
    query: string;
    result: string;
  }> = [];

  async searchWithHistory(query: string, options?: {
    useHistory?: boolean;
    filters?: Record<string, any>;
    limit?: number;
    threshold?: number;
  }): Promise<{ result: string; relatedQueries: string[] }> {
    // Enhance query with session history if requested
    let enhancedQuery = query;
    if (options?.useHistory && this.sessionHistory.length > 0) {
      const recentSearches = this.sessionHistory
        .filter((h) => h.type === "search")
        .slice(-3)
        .map((h) => h.query);

      if (recentSearches.length > 0) {
        enhancedQuery = `${query} (context from recent searches: ${
          recentSearches.join(", ")
        })`;
      }
    }

    const result = await this.search(enhancedQuery, options?.filters, {
      limit: options?.limit,
      threshold: options?.threshold,
    });

    // Store in history
    this.sessionHistory.push({
      timestamp: new Date(),
      type: "search",
      query,
      result: result.substring(0, 500), // Store truncated result
    });

    // Generate related queries based on result
    const relatedQueries = this.generateRelatedQueries(query, result);

    return { result, relatedQueries };
  }

  async intelligentRAG(query: string, options?: {
    autoSearch?: boolean;
    contextDepth?: number;
    filters?: Record<string, any>;
  }): Promise<{
    answer: string;
    sources: string[];
    confidence: number;
  }> {
    let searchContext = "";
    let sources: string[] = [];

    // Automatically search for relevant context if requested
    if (options?.autoSearch !== false) {
      try {
        const searchResult = await this.search(query, options?.filters, {
          limit: options?.contextDepth || 5,
          threshold: 0.6,
        });

        searchContext = searchResult;

        // Extract sources from search results
        const sourceMatches = searchResult.match(
          /--- Result \d+ \(Score: [\d.]+\) ---\n([^\n]+)/g,
        );
        if (sourceMatches) {
          sources = sourceMatches.map((match) =>
            match.replace(/--- Result \d+ \(Score: [\d.]+\) ---\n/, "")
              .substring(0, 100)
          );
        }
      } catch (error) {
        console.warn(
          "Auto-search failed, proceeding with RAG completion:",
          error.message,
        );
      }
    }

    const answer = await this.ragComplete(
      query,
      searchContext,
      options?.filters,
    );

    // Store in history
    this.sessionHistory.push({
      timestamp: new Date(),
      type: "rag",
      query,
      result: answer.substring(0, 500),
    });

    // Calculate confidence based on various factors
    const confidence = this.calculateConfidence(query, answer, sources.length);

    return { answer, sources, confidence };
  }

  async batchIngest(
    documents: Array<{
      content: string;
      metadata?: Record<string, any>;
      topic?: string;
    }>,
  ): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        await this.ingest(doc.content, doc.metadata, doc.topic);
        successful++;
      } catch (error) {
        failed++;
        errors.push(`Failed to ingest document: ${error.message}`);
      }
    }

    return { successful, failed, errors };
  }

  private generateRelatedQueries(
    originalQuery: string,
    searchResult: string,
  ): string[] {
    // Simple algorithm to suggest related queries
    // In practice, you might use an LLM for this
    const words = originalQuery.toLowerCase().split(/\s+/);
    const resultWords = searchResult.toLowerCase().match(/\b\w{4,}\b/g) || [];

    const commonWords = new Set([
      "the",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "up",
      "about",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "between",
    ]);

    const keyWords = resultWords
      .filter((word) => !commonWords.has(word) && !words.includes(word))
      .slice(0, 5);

    const relatedQueries = keyWords.map((keyword) =>
      `${originalQuery} ${keyword}`
    );

    return relatedQueries.slice(0, 3); // Return top 3 suggestions
  }

  private calculateConfidence(
    query: string,
    answer: string,
    sourceCount: number,
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on answer length (more detailed = higher confidence)
    if (answer.length > 200) confidence += 0.1;
    if (answer.length > 500) confidence += 0.1;

    // Increase confidence based on number of sources
    confidence += Math.min(sourceCount * 0.1, 0.3);

    // Decrease confidence if answer is too short or generic
    if (answer.length < 50) confidence -= 0.2;
    if (answer.includes("I don't know") || answer.includes("no results")) {
      confidence -= 0.3;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  getSessionSummary(): {
    totalQueries: number;
    searchQueries: number;
    ragQueries: number;
    ingestionCount: number;
    recentActivity: string[];
  } {
    const totalQueries = this.sessionHistory.length;
    const searchQueries =
      this.sessionHistory.filter((h) => h.type === "search").length;
    const ragQueries =
      this.sessionHistory.filter((h) => h.type === "rag").length;
    const ingestionCount =
      this.sessionHistory.filter((h) => h.type === "ingest").length;

    const recentActivity = this.sessionHistory
      .slice(-5)
      .map((h) => `${h.type}: ${h.query}`)
      .reverse();

    return {
      totalQueries,
      searchQueries,
      ragQueries,
      ingestionCount,
      recentActivity,
    };
  }

  clearHistory(): void {
    this.sessionHistory = [];
  }
}
