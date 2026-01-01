# Tieto - File-based RAG or Retrieval For LLMs Implemented Entirely With Deno

Tieto was created to provide local (quantized / GGUF) large language models
operating in resource-constrained environments with text-based retrieval and
retrieval-augmented generation capabilities.

Tieto is also the Finnish word for knowledge.

Using Tieto, llama.cpp, and an embedding model, you can query local
text/markdown documents and filter by frontmatter metadata.

Tieto understands two modes of operation: _**retrieval-only**_ and
_**completion**_. In retrieval-only mode, Tieto queries the document pool to
find any context surrounding the user's query. In _completion_ mode, Tieto
presents what it found along with any metadata in a prompt along with the user's
query to a completion model to answer, which can be local or remote. This is how
it provides retrieval augmented generation.

Paths, endpoints and everything else is controlled in an easy to use class.

> [!IMPORTANT]\
> Tieto is in its very early stages; while already very useful, is not yet
> stable. Bugs, math errors, breaking changes, almost no documentation and even
> (_gasp_) sub-optimal code is ahead. Tieto is pre-release.

## How It Works:

A text corpus is ingested into a JSONL vector index ([example index][1]).

Texts are chunked and embedded using a llama.cpp-compatible embedding model.

Cosine similarity is used to rank the most relevant chunks per query.Matching
documents are returned with optional metadata filtering (via frontmatter).

### Frontmatter-Aware Ingestion

Each document can include frontmatter in YAML/JSON style:

```yml
---
key: value
key1: value1
key2: value2
---

Text corpus you want to ingest goes here...
```

Filtering supports `=`, `<=`, `>=`, `in`, and compound clauses. Tieto "just
works" to add semantic search to most modern documentation.

Chunk size, et al, are configurable at runtime.

### Cosine Similarity & Euclidean Distance Primer

Cosine similarity measures the angle between two vectors.

A vector represents a chunk of text (after embedding). A score close to 1.0
means "nearly identical in direction" (high semantic similarity).

Unlike Euclidean distance, cosine similarity ignores magnitude, so you capture a
broad (semantic) search.

That's great for knowing what's relevant to rank, but not always great at
ranking it. That's why we then sort by Euclidean distance, with the closest
being the most related to the specifics of the user's query, not just the
semantics. Euclidean distance looks at the magnitude of the angle to better
understand how close all of the vectors in the user query matched.

A great metaphor is:

_**Cosine similarity does the heavy digging; Euclidean distance does the
sifting. This of course works best when there's gold in the ground to begin with
:)**_

This provides very capable and very flexible retrieval of unstructured document
data for search interfaces, LLM context queries and more. It's also very useful
for RAG when it comes to product updates, current events, policy changes, or
other instances where language models need context that's fresher than their
training.

Tieto also makes an excellent chat archive tool.

## Requirements:

- Access to an embedding model (Nomic Text recommended).
- Access to a model to analyze results (optional)
- Deno

## How To Use:

Grab the code and look at the `tieto.ts` executable script, which provides a
basic demo for how the class works. See the class itself in `src/`. You need to
either start an embedding model locally, or configure your provider API info.

I highly recommend Nomic Text Embed locally, or Nomic Atlas if you have to use a
third-party API. Both are free and very high quality.

The simplest invocation:

```ts
import { Tieto } from "./src/tieto.class.ts";

// recommend debug until everything works
const tieto = new Tieto({ debug: true });

await tieto.ingest("topics/topic_name/documentation.md");
await tieto.query("topic_name", user_query, metadata_filters);
```

You can also ingest independent turns from a chat conversation with all the
metadata you need (very useful for long-term semantically-accessible memory). It
doesn't _have_ to be a file.

### Default Layout

Tieto takes advantage of the file system structure for its own organization. In
fact, `btrfs` is the preferred way to go, with each topic being snapshot-able
independently from the others, with `git` used to manage versioning of the
`.jsonl` indexes.

But getting started, we just have `topics/` in the repo, with `acme-corp` being
the sole topic:

```txt
topics/
   acme-corp/
      latest-pricing.txt
      memory/
         latest-pricing.jsonl
```

When you run
`./tieto ingest topics/acme-corp/latest-pricing.txt, it writes the index
to the`memory/`
location. This can be configured in the class.

At some point in the future I plan to add a clustered index to the root topic
directory.

Once you have files ingested, you can run:

```bash
./tieto ask acme-corp "Do we have a compact widget?"
./tieto ask acme-corp "What is the price of our deluxe model?"
```

It will return excerpts of text that a completion LLM (or knowledgeable person)
would need to be able to answer the questions.

... and, note that it figured out "travel" from "compact" in the first example.

Adjust the cosine similarity scoring to "level out" the kind of content you're
indexing, and then L1 (Euclidean distance), and ultimately L2 (Manhattan distance) 
if it's meaningful; whatever you need. Just understand it has to be manually
tweaked before the magic happens.

[1]: https://github.com/timthepost/tieto/blob/main/topics/acme-corp/memory/latest-pricing.jsonl
