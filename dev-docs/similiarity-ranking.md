# Working With Cosine Similarity Ranking (A Tutorial)

You can read-a-long or query-a-long with this; I'm including all commands and
results as text here so you can see what I'm doing.

## Primer (not needed if just reading-a-long)

Sometimes cosine similarity can seem deceptively like working with (unintuitive)
full-text search. In order to better illustrate just how different they are, you
can run some queries against some `acme-corp` data that has already been
ingested into memory.

I'll begin by starting my local embedding model:

```sh
llama-server -m /home/dev/models/1b-nomic-embed.gguf --embedding --port 8080
```

Next, I'll open another terminal tab and navigate to my tieto source directory,
and run some queries in debug mode. For reference, we're working with the data
in `topics/acme-corp/latest-pricing.txt` which has been ingested into the
`jsonl` database found in the `memory/` subdirectory.

If you want, poke around these files a little now - note the frontmatter in the
plain text version, and note how that carries over into the embedded version.

## Tutorial

Now, from the same folder where `tieto.ts` resides, I'll run the following
query:

```sh
deno run -A ./tieto.ts ask acme-corp "Do we have a travel widget?" --debug
```

```yml
[debug] Parsed filters []
[debug] Query: minimum score for inclusion is  0.42
[debug] Query: winning score from memory was  0.6028476180515044
-----
Text:  description: A travel widget
price: $19.95
last_updated: 2025-06-01
Score: 0.6028476180515044
-----
Text:  A widget is a personal health product that we sell.
product: Widget A
alias: Product A
Score: 0.4961324309715374
-----
Text:  description: A better deluxe widget
price: $45.50
last_updated: 2025-06-15
Score: 0.43858287562043485
```

The output also contains a prompt fragment to be included with a completion
model, but we're only looking for the debug info right now. Note the scores, and
the drop from the top result to the ones below it. Keep that in mind as we go.
We're at "60% certain this is related (to the query)."

Let's change it a bit:

```sh
deno run -A ./tieto.ts ask acme-corp "A travel widget 19.95" --debug
```

```yml
[debug] Parsed filters []
[debug] Query: minimum score for inclusion is  0.42
[debug] Query: winning score from memory was  0.7842300616330571
-----
Text:  description: A travel widget
price: $19.95
last_updated: 2025-06-01
Score: 0.7842300616330571
-----
Text:  description: A good mid-range widget
price: $29.99
last_updated: 2025-06-04
Score: 0.5729132036526612
-----
Text:  description: A better deluxe widget
price: $45.50
last_updated: 2025-06-15
Score: 0.5628093513386672
```

Look at the _**scores**_. We included the price, which boosted confidence. Which
means (as you would rightly suspect) that including more frontmatter even
without the `--filter` tag helps boost confidence in results returned if you're
fishing for a tangential match, including it _in order_ helps even more, for
instance:

```sh
 deno run -A ./tieto.ts ask acme-corp "description: A travel widget price: \$19.95 last_updated: 2025\-06\-01" --debug
 ```

```yml
 [debug] Parsed filters []
[debug] Query: minimum score for inclusion is  0.42
[debug] Query: winning score from memory was  0.9913931356906674
-----
Text:  description: A travel widget
price: $19.95
last_updated: 2025-06-01
Score: 0.9913931356906674
-----
Text:  description: A good mid-range widget
price: $29.99
last_updated: 2025-06-04
Score: 0.8303199196287552
-----
Text:  description: A better deluxe widget
price: $45.50
last_updated: 2025-06-15
Score: 0.7990393156595532
```

That's as close to 100% certainty as you'll likely ever get, because what we're
looking for is signal over negligible noise, not a perfect well-rounded number.

If you want real control, use `--filter` and metadata. If you want to give the
algorithm subtle hints on scoring, be explicit with known strings in the text
(in this case `price:` or `description:` to order independently of the filters)

However, don't be deceived. I'm going to edit `tieto.ts` and change the value of
`minSimilarityThreshold = 0.42` to `0.32` and run again with a slightly
different query (that anyone designing a policy-based corporate RAG that has to
query SOP and HR docs will know about):

```sh
deno run -A ./tieto.ts ask acme-corp "what is our sexual harassment policy?" --debug
```

```yml
[debug] Parsed filters []
[debug] Query: minimum score for inclusion is  0.32
[debug] Query: winning score from memory was  0.33811819297968737
-----
Text:  A widget is a personal health product that we sell.
product: Widget A
alias: Product A
Score: 0.33811819297968737
-----
Text:  customer_rating: 1/10
Score: 0.3209097605585371
-----
Text:  customer_rating: 8/10
product: Widget B
alias: Product B
Score: 0.3176448962041357
```

Similarity plummeted, but there _**was**_ relation to _sexual_ and _health_. Not
really just full text (`LIKE`), although _similarity_ in known components,
especially in order, matters a lot.

Cosine similarity compares the meaning of your query to the memory embeddings, not the literal words. It's like asking: *Do these feel like they're about the same thing?*

### Similarity Threshold Setting Breakdown Table

I will soon be making the threshold configurable per query, and here's the
approximate effects:

| Threshold   | What To Expect                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| 0.01 - 0.25 | Almost unfiltered chaos; almost useless.                                                               |
| 0.26 - 0.31 | Very tangential relations may surface.                                                                 |
| 0.32 - 0.40 | Linguistically similar, but not usually really related. (e.g. "Sexual harassment" => "Health product") |
| 0.40 - 0.59 | Worthy of including in results                                                                         |
| 0.60 - 0.99 | A strong relation (commensurate with distance from 0.6)                                                |

This varies with the depth of text and language (as soon as multi-language is
supported on embedding ).
