// metadata‑aware RAG and retrieval with safe filtering & debug
// uses cosine similarity, file-file topics and JSONL sections.
// Scales easily over local or network storage.
// ============================================================
// TODO: Make this a class with config opts

import { walk } from "https://deno.land/std@0.204.0/fs/walk.ts";
import { join } from "https://deno.land/std@0.204.0/path/mod.ts";
import { extract } from "https://deno.land/std@0.204.0/front_matter/yaml.ts";

// for filter parsing
type Op = "=" | ">=" | "<=" | ">" | "<" | "in";
interface Filter {
  key: string;
  op: Op;
  value: string | string[];
}

// the minimum similarity required to output a match.
// 0.40 is pretty noisy
// 0.38 and below is almost unfiltered
// Was not a planned Hitchhiker's Guide To The Galaxy allusion.
const minSimilarityThreshold = 0.42;

// query + filter + result debugging
const DEBUG = Deno.args.includes("--debug") || Deno.env.get("DEBUG") === "1";

function logDebug(...args: unknown[]) {
  if (DEBUG) console.log("= [debug]", ...args);
}

// extremely fast comparison
function cosineSimilarity(a: number[], b: number[]): number {
  // console.log('CS: ', a.length, b.length);
  const dot = a.reduce((s, ai, i) => s + ai * b[i], 0);
  const na = Math.hypot(...a);
  const nb = Math.hypot(...b);
  // console.log('CS: ', (dot  / (na * nb)));
  return dot / (na * nb);
}

// a slightly more performant, but also slightly less
// stable implementation that may be useful with
// very large documents in high-volume scenarios.
// Much more error-prone in rounding, among other things.
// (also was an early implementation)
function _cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

// reference for how magnitude would affect a query
// can also be a secondary signal for certain uses. 
function _euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same dimension.");
  }
  const sumOfSquaredDifferences = a.reduce((sum, ai, i) => {
    const difference = ai - b[i];
    return sum + difference * difference;
  }, 0);
  return Math.sqrt(sumOfSquaredDifferences);
}

// You can modify this to use a third-party embedding model, if you
// need to.
async function embed(text: string): Promise<Float32Array> {
  const response = await fetch("http://localhost:8080/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: text }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${errText}`);
  }

  const json = await response.json();

  if (
    !json.data ||
    !Array.isArray(json.data) ||
    !json.data[0]?.embedding ||
    !Array.isArray(json.data[0].embedding)
  ) {
    throw new Error("Embedding output malformed or missing");
  }

  return new Float32Array(json.data[0].embedding);
}

async function ingest(path: string) {
  const raw = await Deno.readTextFile(path);
  const { attrs: meta, body } = extract(raw);
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  const chunks = [] as {
    text: string;
    embedding: number[];
    meta: Record<string, unknown>;
  }[];

  for (let i = 0; i < lines.length; i += 3) {
    const text = lines.slice(i, i + 3).join("\n");
    const vec = Array.from(await embed(text));
    chunks.push({ text, embedding: vec, meta });
  }

  const [, topic, nameTxt] = path.split("/");
  const out = `topics/${topic}/memory/${nameTxt.replace(/\.txt$/, ".jsonl")}`;
  await Deno.writeTextFile(
    out,
    chunks.map((c) => JSON.stringify(c)).join("\n"),
  );
  logDebug(`✅ Ingested → ${out}`);
}

function parseFilters(args: string[]): Filter[] {
  const filters: Filter[] = [];
  for (let i = 0; i < args.length; i++) {
    let expr: string | undefined;
    // styles:  --filter key=val   OR  --filter=key=val
    if (args[i] === "--filter") {
      expr = args[i + 1];
      i++; // skip value token
    } else if (args[i].startsWith("--filter=")) {
      expr = args[i].slice("--filter=".length);
    }
    if (!expr) continue;

    const match = expr.match(/^([^\s><=]+)\s*(>=|<=|=|>|<|in)\s*(.+)$/);
    if (!match) {
      logDebug(`⚠️  Ignoring bad filter expression: '${expr}'`);
      continue;
    }
    const [, key, op, valRaw] = match as [string, string, Op, string];
    const value: string | string[] = op === "in"
      ? valRaw.split(",").map((s) => s.trim())
      : valRaw.trim();
    filters.push({ key, op, value });
  }
  logDebug("Parsed filters", filters);
  return filters;
}

function satisfies(meta: Record<string, unknown>, f: Filter): boolean {
  const actualRaw = meta?.[f.key];
  if (actualRaw === undefined || actualRaw === null) return false;

  // convert arrays, objects → string consistently for comparison
  const actualStr = Array.isArray(actualRaw)
    ? actualRaw.join(",")
    : actualRaw.toString();

  if (f.op === "=") return actualStr === f.value;
  if (f.op === "in") {
    const list = Array.isArray(f.value)
      ? f.value
      : (f.value as string).split(",");
    return list.includes(actualStr);
  }

  // numeric or date compare
  const left = Number(actualStr) || Date.parse(actualStr);
  const right = Number(f.value as string) || Date.parse(f.value as string);
  if (isNaN(left) || isNaN(right)) return false;

  switch (f.op) {
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case "<":
      return left < right;
  }

  // default
  return false;
}

async function query(topic: string, question: string, filters: Filter[]) {
  const memDir = join("topics", topic, "memory");
  const chunks: {
    text: string;
    embedding: number[];
    meta: Record<string, unknown>;
  }[] = [];

  for await (
    const file of walk(memDir, { exts: [".jsonl"], includeDirs: false })
  ) {
    const lines = (await Deno.readTextFile(file.path)).trim().split("\n");
    for (const line of lines) {
      const c = JSON.parse(line);
      if (filters.every((f) => satisfies(c.meta ?? {}, f))) {
        chunks.push(c);
      } else {
        logDebug("⛔ Excluded by filter:", c.meta);
      }
    }
  }

  if (!chunks.length) {
    logDebug("⚠️  No data matched filters", filters);
    return;
  }

  const qVec = Array.from(await embed(question));
  const scored = chunks.map((c) => (
    { ...c, score: cosineSimilarity(c.embedding, qVec) }
  ))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const context = scored.map((c) => c.text).join("\n\n");

  logDebug("Query: minimum score for inclusion is ", minSimilarityThreshold);
  logDebug("Query: winning score from memory was ", scored[0].score);
  if (DEBUG) {
    for (const element of scored) {
      console.log("===");
      console.log("= Text: ", "\"" + element.text.replace(/\n/g, "\\n").replace(/\r/g, "\\r") + "\"");
      console.log("= Cosine Similarity Score: ", element.score);
      console.log("= Euclidean Distance: ", _euclideanDistance(qVec, element.embedding));
    }
    console.log("===");
  }

  if (scored[0].score < minSimilarityThreshold) {
    logDebug(
      "⚠️  No chunks scored above threshold. Highest was: ",
      scored[0].score,
    );
    return;
  }

  const prompt =
    `Use the information between the dashes "---" to answer the question that follows:\n\n---\n\n${context}\n\n---\n\nQuestion: ${question}`;
  const url = Deno.env.get("RAG_COMPLETION_URL");
  if (!url) {
    console.log(prompt);
    return;
  }

  // could send this to a third-party completion API too, if privacy is
  // not a concern.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, temperature: 0, n_predict: 128 }),
  });

  const { content } = await res.json();
  console.log((content ?? "").trim());
}

// basic CLI
// (this needs some love)

const [cmd, ...argv] = Deno.args.filter((a) => a !== "--debug");

if (cmd === "ingest") {
  const file = argv[0];
  if (!file) {
    console.error("Usage: deno run -A rag.ts ingest <topics/.../file.txt>");
    Deno.exit(1);
  }
  ingest(file);
} else if (cmd === "ask") {
  const topic = argv[0];
  const q = argv.filter((a) => !a.startsWith("--filter")).slice(1).join(" ");
  const filters = parseFilters(argv);

  if (!topic || !q) {
    console.error(
      'Usage: deno run -A rag.ts ask <topic> "<question>" [--filter …] [--debug]',
    );
    Deno.exit(1);
  }
  query(topic, q, filters);
} else {
  console.log("Usage:");
  console.log(
    "  deno run --allow-read --allow-write rag.ts ingest topics/acme-corp/products.txt",
  );
  console.log(
    '  deno run --allow-read rag.ts ask acme-corp "What is Widget A?" --filter status=current',
  );
  console.log(
    '  deno run --allow-read rag.ts ask acme-corp "What models come in blue?" --filter price < 50',
  );
  console.log("\nFiltering supports =, <=, >=, in, and compound clauses.");
}
