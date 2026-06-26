---
series: "drafting-table"
title: "What a load test taught us"
dek: "A bottleneck we couldn't see, a 400ms query that became 0.3ms, and why 'a lot of data' isn't the same as 'slow.'"
part: 4
date: 2026-06-26
readingTime: "9 min"
tags: ["performance", "postgres", "load-testing"]
---

You can reason about performance all day. Then you measure it and learn what's actually true. We seeded a throwaway database, pushed it to **a million records**, and timed things. Here's what fell out — including a bottleneck we'd never have guessed.

A note on method: these are numbers from a developer laptop with a single server process. Treat them as *relative* truths — for spotting bottlenecks and understanding how things scale — not as absolute production capacity. (We ran everything against a separate, disposable database so real data was never touched.)

## Setup

One entity, seeded to 1,000 → 10,000 → 100,000 → 1,000,000 rows. At each size we timed a few representative queries: fetch one record by id, list the first page, filter, and count.

## Result #1: fetching one record is basically free, at any size

| rows | fetch one by id |
|---:|---:|
| 1,000 | 0.1 ms |
| 100,000 | 0.2 ms |
| 1,000,000 | 0.9 ms |

Looking up a single record by its id stays sub-millisecond even at a million rows. That's because the id is **indexed** — an index is like a book's index: instead of scanning every page, the database jumps straight to the entry. This is the happy path, and it scales beautifully.

## Result #2: the bottleneck we couldn't see

Listing the first page of records told a different story:

| rows | list first page |
|---:|---:|
| 1,000 | 1.3 ms |
| 10,000 | 11 ms |
| 100,000 | 63 ms |
| 1,000,000 | **409 ms** |

That growth is *linear* — ten times the data, ten times the time. For a "give me 50 rows" query, that's wrong. Fifty rows is fifty rows; it shouldn't matter whether there are a thousand behind them or a million.

The cause: we list records in a defined order (`ORDER BY` a sequence number), and there was **no index on that ordering**. So to return the first 50, Postgres first **sorted all million rows**, then took 50. The sort is the cost, and the sort grows with the data.

The fix was one line — add an index that matches the ordering:

```sql
create index on records (tenant_id, entity_type, seq);
```

Now the database walks the index in order and stops after 50. Same query, at a million rows:

> **409 ms → 0.31 ms.** About 1,300× faster, from one index.

This is the whole reason to load-test. The bug wasn't visible in code review or at small scale — only measurement at size revealed it.

## Result #3: it shows up end-to-end, dramatically

We then hammered the actual API with many simultaneous clients. Before the index, at a million rows, the service managed about **2 requests per second** and buckled under concurrency (requests queued behind those giant sorts). After the index:

| concurrent clients | before | after |
|---:|---:|---:|
| 1 | 2 req/s | **215 req/s** |
| 8 | 2 req/s | **940 req/s** |

Same code, same data, same machine. One index moved the ceiling by ~100–400×. (Throughput plateaus past ~8 clients here because it's a single server process — more processes would push it further; the database wasn't the limit.)

## Result #4: size isn't speed — *which slice you touch* is

The most important lesson is subtle. We put a **100,000-row** slice and a **2,000,000-row** slice into the *same* shared table, then timed a query against the small slice:

| slice | its rows | page query |
|---|---:|---:|
| A | 100k (of 2.1M total) | 0.8 ms |
| B | 2M (of 2.1M total) | 1.0 ms |

Slice A's query is just as fast as if the other 2 million rows weren't there. Why? Because the index **prunes** — it jumps straight to A's rows and never looks at B's.

The takeaway, which governs how this platform scales:

> A well-indexed query's cost depends on the **slice of data it actually touches**, not on the total size of the table.

In our world, a user request touches *one customer's one entity*. So as long as queries are filtered by customer and entity (they always are — see [Part 2](/posts/02-tenant-isolation-rls/)) and the right indexes exist (see [Part 3](/posts/03-constraints-and-relationships-on-json/)), interactive speed is governed by *that customer's* data, not the global pile.

## Result #5: "tall" and "wide" cost differently

Two ways to reach a billion records: **tall** (a few entities, each with millions of rows) or **wide** (millions of entities, each with a few rows). Same total, very different costs.

- **Tall** is the sweet spot. One entity = one view, a tiny amount of metadata. The data-handling machinery we measured above applies, and it's fine.
- **Wide** is cheap *per query* but expensive on the **catalog** — Postgres's internal bookkeeping. Each entity adds a view and indexes, so millions of entities means millions of catalog objects: slow to create, heavy to back up, more bookkeeping everywhere. We confirmed creation rate sags as the catalog grows.

So the platform is built for what real customers actually do — a *modest number of entity types* (dozens to hundreds), each holding *lots of rows*. That's the shape it's tuned for.

## When the single shared table *does* hit a wall

At truly enormous scale — think tens of billions of rows in one physical table — single-node storage gets operationally heavy (backups, vacuuming, index maintenance). The fix is **partitioning**: transparently splitting the one logical table into many physical chunks, by customer. Each chunk stays small and manageable, and because every query already filters by customer, the database automatically reads only the relevant chunk.

The good news: it can be added **later**, as a storage migration, without changing application code — the access patterns are already partition-friendly. The one cheap thing we did up front was make the table's primary key tenant-leading, so that future split needs no surgery on live data. Pay for scale when you reach it, not before.

## The meta-lesson

Three of these five findings were invisible until we measured: the missing index, the concurrency collapse, and the pruning behavior. Reasoning told us the architecture *should* scale; measuring told us *where* it didn't yet, and the fixes were small and surgical.

> Build the thing, then make it tell you the truth.

That wraps the first arc of this series — from "why" through architecture, isolation, constraints, and performance. Thanks for reading the field notes. More to come as we build out the rest: the visual builder, generated dashboards, and bringing customer data in.
