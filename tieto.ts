#!/usr/bin/env -S deno run -A

/**
 * VERY limited "cli" implementation done mostly to illustrate the class.
 * This will be replaced with something that uses one of Deno's heavily-tested
 * CLI libraries.
 * 
 * It works for now :) 
 */

import { Tieto } from "./src/tieto.class.ts";

if (import.meta.main) {
  const [cmd, ...argv] = Deno.args.filter((a) => a !== "--debug");
  // Tieto can work with just env vars and defaults for most cases, 
  // but debug is passed to be illustrative of functionality.
  // Turn it off if too noisy for "basic CLI"
  const tieto = new Tieto({debug: true});

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
