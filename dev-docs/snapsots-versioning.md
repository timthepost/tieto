# Snapshots and Versioning with Tieto

Tieto plays well with both **version control** and **modern file systems**. In
fact, you should use both. They solve different problems and complement each
other beautifully.

On modern GNU/Linux systems, you have two great tools at your disposal:

- Version control: `git`, `hg`, `svn`—but probably `git`
- Filesystem-level snapshots: `btrfs`, ZFS, or anything CoW-aware

Tieto doesn’t require a database. It’s just a giant pile of embeddings (mostly
floats) and associated text, typically stored in `.jsonl` files—many lines, each
a discrete node.

That makes this data **trivially versionable** and **natively
snapshot-friendly**, as long as you organize it right.

---

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

Then symlink to that UUID with a friendly name:

```
docs/llama-3-intro.md -> 3b75fa10-3ffb-4d1d-8e1a-0b2c53d7baf7.md
```

This prevents collisions and makes Git’s deduplication behave predictably when
you archive or split repositories later.

---

## 🧠 Git: Local Version Control

Use Git for **per-topic versioning**. One repo per topic is ideal.

Git performs great up to around **100–150k commits**. After that, things get a
bit swampy unless you `gc` regularly and avoid long delta chains.

If a topic’s history gets too large:

1. Make a clean clone into a new directory
2. Rename the old repo (e.g. `topic-archive-2025-08`)
3. Start fresh in the original spot

Boom: instant repo rotation. You can even write a wrapper script to search
across rotated archives if needed.

This lets you snapshot _semantic_ changes in the topic over time without locking
yourself into a monolithic repo with years of sludge.

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

## 🪰 ext4?

Use ext4 only if:

- You're on legacy systems
- You don't need snapshots
- You’re okay with \~10,000 directories before performance drops

It works fine for small setups, but lacks CoW, snapshots, and scales poorly with
massive directory trees. If you're going big, skip it.

---

## 💡 Best Practice Stack

| Layer         | Tool     | Purpose                                 |
| ------------- | -------- | --------------------------------------- |
| File naming   | UUIDs    | Collision-proof, deduplicatable         |
| Human lookup  | Symlinks | Friendly names, no rename headaches     |
| Versioning    | Git      | Commit-based snapshots per topic        |
| Rotation      | Git      | Manual repo rollover after 150k commits |
| Snapshots     | Btrfs    | Atomic, filesystem-level backup points  |
| Deduplication | Reflinks | Efficient file copies for reuse         |
