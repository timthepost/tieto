#!/usr/bin/env -S deno run -A

/**
 * VERY limited "cli" implementation done mostly to illustrate the class.
 * This will be replaced with something that uses one of Deno's heavily-tested
 * CLI libraries.
 * 
 * It works for now :) 
 * 
 * Normally, you can give just read/net/write/env permissions to deno
 * But when shebang-ing, it's just easier to use -A. You can use the class
 * with just --allow-read in prod, with --allow-write in dev if you like, but
 * it needs to be abe to read env vars and use the network for most uses.
 * 
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
      console.error("Usage: ./tieto ingest <topics/.../file.txt>");
      Deno.exit(1);
    }
    await tieto.ingest(file);
  } else if (cmd === "ask") {
    const topic = argv[0];
    const q = argv.filter((a) => !a.startsWith("--filter")).slice(1).join(" ");
    const filters = tieto.parseFilters(argv);

    if (!topic || !q) {
      console.error(
        'Usage: ./tieto ask <topic> "<question>" [--filter …] [--debug]',
      );
      Deno.exit(1);
    }
    await tieto.query(topic, q, filters);
  } else {
    console.log("Usage:");
    console.log(
      "  ./tieto ingest topics/acme-corp/products.txt",
    );
    console.log(
      '  ./tieto ask acme-corp "What is Widget A?" --filter status=current',
    );
    console.log(
      '  ./tieto ask acme-corp "What models come in blue?" --filter audience=all',
    );
    console.log("\nFiltering supports =, <=, >=, in, and compound clauses.");
  }
}
