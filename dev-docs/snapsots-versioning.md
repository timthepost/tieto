# Snapshots and Versioning with Tieto

Tieto plays well with both **version control** and **modern file systems**. 
You should probably consider both, because they solve different problems and 
complement each other beautifully.

On modern GNU/Linux systems, the following things have never been easier to
install:

- Version control: `git`, `hg`, `svn`—but probably `git`
- Filesystem-level snapshots: `btrfs`, ZFS, or anything CoW-aware

Tieto doesn’t require a database and isn't one itself. It’s just a giant pile 
of embeddings (mostly floats) and associated text, typically stored in `.jsonl` 
files, which are many lines of JSON with each being a discrete node.

That makes this data **trivially versionable** and **natively
snapshot-friendly**, as long as you organize it proactively.

"_Let Unix Be Unix_" is a driving philosophy behind most things that I develop
and it strongly applies here.

## 🔁 Directory Structure and Scaling

Organize your topics as directories. One topic = one directory. Inside each
topic, you’ve got lots of text nodes. This might scale to:

- Thousands of topics
- Thousands of documents per topic
- Frequent updates (daily, hourly, or more)

To handle this sanely:

### ✅ Use UUIDs for file names

Each document you ingest should be saved using a UUID filename:

```
docs/3b75fa10-3ffb-4d1d-8e1a-0b2c53d7baf7.md
```

Then (optionally) symlink to that UUID with a friendly name:

```
docs/llama-3-intro.md -> 3b75fa10-3ffb-4d1d-8e1a-0b2c53d7baf7.md
```

This prevents collisions and makes Git’s deduplication behave predictably when
you archive or split repositories later. You can also use a KV store or something
else to relate human -> uuid lookup, store symlinks in a whole other directory, or
whatever makes sense for you. 

---

## 🧠 Git: Local Version Control

Use Git for **per-topic versioning**. One repo per topic is ideal.

Git performs great up to around **100–150k commits**. After that, things get a
bit swampy unless you `gc` regularly and avoid long delta chains.

If a topic’s history gets too large:

1. Make a clean (shallow) clone into a new directory
2. Rename the old repo (e.g. `topic-archive-2025-08`); rename the new directory
   to be the topic repo.
4. Start fresh right where you left off in the one you just archived.

Boom: instant repo rotation. You can even write a wrapper script to search
across rotated archives if needed. It requires a minimal window where no commits 
can be made and some coordination for very old point-in-time rollback, but gives 
you the ability to snapshot _semantic_ changes in the topic over time without locking
yourself into a monolithic repo with years of sludge.

Not bad for a RAG written in a little TypeScript.

---

## 📆 Btrfs: Filesystem-Level Snapshots

Use `btrfs` if you want **fast, atomic, whole-topic snapshots**. It’s great for:

- Daily/weekly snapshots
- Rollbacks after bad ingests
- Metadata backups

Each **topic should be a btrfs subvolume**, not just a directory:

```bash
btrfs subvolume create /mnt/tieto/langmodels
```

Now you can snapshot it:

```bash
btrfs subvolume snapshot /mnt/tieto/langmodels /mnt/snapshots/langmodels_$(date +%F)
```

This works independently of Git, and gives you coarse-grained time travel even
without commits.

You can also reflink individual files (`cp --reflink`) if you want zero-cost
duplication inside or between topics.

---

## 🪰 ext4? fat?

Use ext4 only if:

- You're on legacy systems
- You don't need snapshots
- You’re okay with \~10,000 directories before performance drops

It works fine for small setups, but lacks CoW, snapshots, and scales poorly with
massive directory trees. If you're going big, skip it.

Other file systems (fat, IPFS. others) could be made to work for very simple setups, 
but won't be directly supported because of extension incompatibilities and so on. I
may try IPFS just for the fun of it sometime.

## 💡 Best Practices Reviewed:

| Layer         | Tool     | Purpose                                 |
| ------------- | -------- | --------------------------------------- |
| File naming   | UUIDs    | Collision-proof, deduplicatable         |
| Human lookup  | Symlinks | Friendly names, no rename headaches     |
| Versioning    | Git      | Commit-based snapshots per topic        |
| Rotation      | Git      | Manual repo rollover after 150k commits |
| Snapshots     | Btrfs    | Atomic, filesystem-level backup points  |
| Deduplication | Reflinks | Efficient file copies for reuse         |

Out of the box, Git + Btrfs + a little structure to how you name and arrange
text nodes goes a long way to something that scales really nicely.

Or, use it forever on ext4 alone if you just need something fast and easy
to use with almost zero overhead and no telemetry or SOC footprint impact.



