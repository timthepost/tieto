# Tieto - File-based RAG or Retrieval For gguf LLMs Implemented Entirely With Deno

Tieto was created to provide local (quantized / GGUF) large language models with
text-based retrieval and retrieval-augmented generation capabilities, in
resource-constrained environments. Tieto is also the Finnish word for knowledge.

Using Tieto, llama.cpp, and [almost any 3B - 8B Q4_K_S or Q4_K_M model][3], you
can easily run a simple interface to query local text/markdown documents. Tieto
was developed on an 11th-gen i3 Chromebook with less than 6GB of usable RAM -
it'll run on any system that can host Deno and a CPU-bound inference engine
(llama.cpp).

Tieto supports frontmatter metadata in files, and allows filtering by metadata
in results. It only requires Deno and access to an embedding model (which most
also run locally) in order to ingest text and make it searchable.

Typescript gets the results, and (if run in completion / RAG mode) they're
delivered in a form that can be injected into the user's prompt to provide the
relevant information necessary to answer the prompt.

In retrieval-only mode, it's extremely useful in scripting or any other scenario
where you need a lightweight serverless text database that is easily queried
through TS or a simple command line program. There's no "service" to run other
than the small embedding model, it's all TypeScript, Markdown and flat (JSONL)
files.

## How It Works:

A text corpus is ingested into a JSONL vector index.

Texts are chunked and embedded using a llama.cpp-compatible embedding model.

Cosine similarity is used to rank the most relevant chunks per query.Matching
documents are returned with optional metadata filtering (via frontmatter).

### Frontmatter-Aware Ingestion

Each document can include frontmatter in YAML/JSON style, e.g.:

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

### Cosine Similarity Primer

Cosine similarity measures the angle between two vectors.

A vector represents a chunk of text (after embedding). A score close to 1.0
means "nearly identical in direction" (high semantic similarity).

Unlike Euclidean distance, cosine similarity ignores magnitude.

Think of it like this: if two people speak differently but say similar things,
cosine similarity will capture that.

## Uses:

- LLM Retrieval (long-term / short term working memory)
  - Make chat history easy to search
  - Easily pipe RSS into text models can ingest in prompts (current events)
  - Have local models summarize meeting transcripts privately
  - Have local models generate better content
  - Game database (RPG characters, quests, etc)
- LLM Completion (RAG)
  - "Explain our vacation policy"
  - "Summarize our social media user's sentiment toward us"
  - "Find the best indica-hybrid on sale at the dispensary"
  - "Find me something to watch on (free tv app)"
- Any text database where cosine similarity ranking makes sense
- Document Indexing (E.g. corporate SOPs, anything exported to text)

As long as you can get the data into TEXT, JSON, YAML or something else that a
model can easily understand, it can be ingested and used. Just understand that
structured code consumes significantly more tokens from available context
windows, which on local models, can already be limited.

## What's Included:

- TS Runtime (ingest and query text)
- Brief tutorial on cosine similarity, context relativity.
- Brief intro to snapshots and point-in-time embedding DB recovery

## Ways To Experiment In Your Own Pipelines:

- Query Pipeline:
  1. Oak API gets user input
  2. Oak API embeds user query, queries tieto
  3. Oak API injects "## Use the following data to answer ..." at the beginning
     of the user prompt (no data if no results)
  4. Local LLM prompt specifically told to not make up results

- Commands Or Inference Interception:
  1. Model emits a special sequence if it needs current information or isn't
     sure of how to answer. This runs a rag query, any results, fact that query
     has already been run, and user's last prompt.
  2. Model evaluates any data from the RAG/retrieval and is prompted with the
     question again.
  3. Model answers based on retrieved data, or replies "I don't know" if no
     results and told not to make things up.

There's also an easy way to fall back to ChatGPT if the RAG doesn't know the
answer if you have an OpenAPI Key, but most use local LLMs to avoid third-party
models (for privacy reasons or just for their SOC profiles). Just orchestrate it
in your Oak middleware.

In both cases, the Oak backend needs to help the model by stacking the context
window correctly, updating text files for the RAG (if using for on-the-fly
remembering of things), and providing output in the expected structure. That's
what makes TypeScript so ideal.

This is not intended for high-volume use, but the only limits to this are the
RAM and underlying file system, as long as you have enough CPU to support at
least the Oak front-end and (ideally) an embedding model. See the `dev-docs/`
folder for more about how to get started. Most modern desktops will not break a
sweat using this, even with high volume document ingestion.

## Next Development Focus

- Configurable read head (up to entire document) for large context windows.
  Default is strong relation only.
- A better (external) CLI:
  - Better 'ingest'
  - Better 'ask'
  - Way to create, refresh, delete topics
  - Way to query supporting model stats?
- I/O through [Splinter][1] (with HTTP/S fallback) using Splinter's
  [Deno FFI bindings][2].
- Queries are already very fast, but topic indexing will improve them.
- This really needs to become a proper class that toosl supporting it
  can just import.

  [1]: https://github.com/timthepost/splinter
  [2]: https://github.com/timthepost/libsplinter/tree/main/bindings/ts
  [3]: https://huggingface.co/
