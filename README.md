# Tieto - File-based RAG or Retrieval For LLMs Implemented Entirely With Deno

Tieto was created to provide local (quantized / GGUF) large language models 
operating in resource-constrained environments with text-based retrieval and 
retrieval-augmented generation capabilities.

Tieto is also the Finnish word for knowledge.

Using Tieto, llama.cpp, and a local LLM, you can query local text/markdown 
documents that are organized and can be filtered with simple frontmatter. 

Tieto understands two modes of operation: ***retrieval-only*** and ***completion***.
In retrieval-only mode, Tieto queries the document pool to find any context
surrounding the user's query. In _completion_ mode, Tieto presents what it found
along with any metadata in a prompt along with the user's query to a completion
model to answer, which can be local or remote. This is how it provides retrieval
augmented generation.

Paths, endpoints and everything else is controlled in an easy to use class.

> [!IMPORTANT]\
> Tieto is in its very early stages; while already very useful, is not yet
> stable. Bugs, math errors, breaking changes, almost no documentation and even
> (_gasp_) sub-optimal code is ahead. Tieto is pre-release.

## How It Works:

A text corpus is ingested into a JSONL vector index.

Texts are chunked and embedded using a llama.cpp-compatible embedding model.

Cosine similarity is used to rank the most relevant chunks per query.Matching
documents are returned with optional metadata filtering (via frontmatter).

### Frontmatter-Aware Ingestion

Each document can include frontmatter in YAML/JSON style. Since the Talmud is an
example of something that lends very well to this kind of indexing, we'll use
it:

```yml
---
topic: halacha
corpus: mishnah
book: berakhot
---
Text goes here...
```

This metadata is parsed at ingest and used to filter search results:

```json
{
  "filters": { "topic": "halacha", "book": "berakhot" }
}
```

Filtering supports `=`, `<=`, `>=`, `in`, and compound clauses.

### Cosine Similarity & Euclidean Distance Primer

Cosine similarity measures the angle between two vectors.

A vector represents a chunk of text (after embedding). A score close to 1.0
means "nearly identical in direction" (high semantic similarity).

Unlike Euclidean distance, cosine similarity ignores magnitude, so you capture
a broad (semantic) search. 

That's great for knowing what's relevant to rank, but not always great at ranking
it. That's why we then sort by Euclidean distance, with the closest being the most
related to the specifics of the user's query, not just the semantics. Euclidean distance
looks at the magnitude of the angle to better understand how close all of the vectors in 
the user query matched.

A great metaphor is:

***Cosine similarity does the heavy digging; Euclidean distance does the sifting. This 
of course works best when there's gold in the ground to begin with :)***

This provides very capable and very flexible retrieval of unstructured document data 
for search interfaces, LLM context queries and more. It's also very useful for RAG 
when it comes to product updates, current events, policy changes, or other instances
where language models need context that's fresher than their training.

Tieto also makes an excellent chat archive tool.

### How To Use:

Grab the code and look at the `tieto.ts` executable script, which provides a basic
demo for how the class works. `topics/` contains a directory named `acme-corp` which
contains some unstructured pricing information to help you dive in.

Individual methods / etc are commented. 