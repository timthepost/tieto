import { Tieto } from "./src/tieto.class.ts";

if (import.meta.main) {
  const [cmd, ...argv] = Deno.args.filter((a) => a !== "--debug");
  const tieto = new Tieto(); // Uses env vars and defaults

  if (cmd === "ingest") {
    const file = argv[0];
    if (!file) {
      console.error("Usage: deno run -A tieto.ts ingest <topics/.../file.txt>");
      Deno.exit(1);
    }
    await tieto.ingest(file);
  } else if (cmd === "ask") {
    const topic = argv[0];
    const q = argv.filter((a) => !a.startsWith("--filter")).slice(1).join(" ");
    const filters = tieto.parseFilters(argv);

    if (!topic || !q) {
      console.error(
        'Usage: deno run -A tieto.ts ask <topic> "<question>" [--filter …] [--debug]',
      );
      Deno.exit(1);
    }
    await tieto.query(topic, q, filters);
  } else {
    console.log("Usage:");
    console.log(
      "  deno run --allow-read --allow-write tieto.ts ingest topics/acme-corp/products.txt",
    );
    console.log(
      '  deno run --allow-read tieto.ts ask acme-corp "What is Widget A?" --filter status=current',
    );
    console.log(
      '  deno run --allow-read tieto.ts ask acme-corp "What models come in blue?" --filter price < 50',
    );
    console.log("\nFiltering supports =, <=, >=, in, and compound clauses.");
  }
}
