# Tieto Service Implementations

> [!WARNING]\
> Most of these will break when run. Very broken & early code here. You've been
> warned.

Tieto can be attached to any number of things, but its roots are in
drop-dead-simple and fast vector-based granular & augmented retrieval.

All implementations, however, require the use of a reasonably high-quality
embedding model like [Nomic Embed][1]. That's a great segue into the first thing
here, the embedding service:

### embedding/

Tieto is going to host a public Nomic server with self-service short-lived keys
for those that need to run at the edge but don't have the benefit of being able
to embed queries on-the-fly.

The code for this is starting to accumulate here, and you're welcome to use it
too. The model itself can be found on HuggingFace.

### mcp

A way to let MCP servers interface with your Tieto instances. One is included
that works specifically for ChatGPT only liking two very particular endpoints,
and then one for everyone else that does it sensibly.

A basic client is included.

### rag-server

Right now just a shell, but this will be both a retrieval system and a
generation (with retrieval augmentation) system very shortly (it's almost done
being the retrieval part).

The API is self-documenting and self-discoverable.
