---
series: "drafting-table"
title: "Unique keys and foreign keys… on JSON"
dek: "How to enforce real constraints and relationships when the data lives in a JSON blob and the schema was invented by a user."
part: 3
date: 2026-06-26
readingTime: "9 min"
tags: ["postgres", "constraints", "jsonb"]
---

Storing data as JSON ([Part 1](/posts/01-the-architecture-bet/)) buys flexibility. The bill comes due when you want **rules**: "a customer's email must be unique," or "an invoice must point to a real customer." With normal database columns these are one-liners. With user-defined fields living inside a JSON blob, they take real engineering. Here's how.

## First, a reframe: JSON isn't a black box

A common misconception: "if it's stored as JSON, the database can't reason about it." Not true for Postgres's JSONB. The database can pull values out of the JSON and even **index** those extracted values. That single capability is what makes everything below possible.

The extraction operator is `->>`: `data ->> 'email'` means "give me the `email` value from the JSON, as text."

## Unique constraints: index the extracted value

A **unique constraint** ("no two rows may share this value") is, under the hood, just a **unique index**. And an index doesn't have to be on a plain column — it can be on an *expression*. So we index the value pulled out of the JSON:

```sql
create unique index on records ((data ->> 'email'))
  where tenant_id = '<customer>' and entity_type = 'customer';
```

A few things are happening:

- `(data ->> 'email')` is the **expression** being kept unique. Postgres computes it for each row and enforces no duplicates — exactly like a column constraint, checked on every insert and update.
- The `where ...` makes it a **partial index**: it only covers this customer's `customer` rows. So uniqueness is *per customer per entity* — Northwind and Helios can both have a `customer@example.com`; neither can have it twice.

**Composite** uniqueness (e.g., a lease is unique per `unit` + `resident`) is the same idea with two expressions:

```sql
create unique index on records ((data ->> 'unit_id'), (data ->> 'resident_id'))
  where tenant_id = '<customer>' and entity_type = 'lease';
```

The platform generates these from the registry whenever a customer marks fields as unique. And if existing data already has duplicates, building the index fails — so we pre-check and report the offending values instead of throwing a raw error.

## The same trick powers filtering and sorting

Here's a payoff that surprised us. Those expression indexes aren't just for uniqueness — a regular (non-unique) one makes **filtering and sorting** on a JSON field fast:

```sql
create index on records (((data ->> 'amount')::numeric))
  where tenant_id = '<customer>' and entity_type = 'invoice';
```

Without it, "sort invoices by amount" scans and sorts every row. With it, it's an index lookup. So in the builder, customers mark which fields they'll filter or sort by, and we generate exactly those indexes (capped to a handful, since each one adds write cost). More on the performance angle in [Part 4](/posts/04-what-load-testing-taught-us/).

## Foreign keys: the part that *can't* use the normal tool

A **foreign key** is the rule "this value must point to a real row in another table" — e.g., an invoice's `customer` must be an existing customer. Postgres has native foreign keys… and they **don't fit here**, for three reasons:

1. **They require a real column, not a JSON expression.** Our reference lives at `data ->> 'customer'`. Native foreign keys can't target an expression.
2. **They can't target a *subset* of a table.** Everything is in one shared `records` table, so a native key would let `customer` point at *any* record — an invoice, a vendor, anything — not specifically a customer.
3. **They can't be scoped per customer.** There's no way to say "...and only within this tenant."

So, exactly like uniqueness, we enforce relationships with a **mechanism we generate ourselves** rather than a built-in constraint. We use **triggers**.

A **trigger** is a function the database runs automatically on every insert, update, or delete. We wrote two generic ones — generic meaning they work for *every* entity by consulting the registry, with no per-entity code:

- **On write:** for each field the registry marks as a link, check that the referenced id actually exists as a record of the right type, in the same tenant. If not, reject the write.
- **On delete:** before deleting a record, check whether anything still links to it. If so, block the delete (so you can't orphan a reference). This is the standard "restrict" behavior.

Because the triggers live in the database, the rule holds even for writes that bypass the application entirely — we verified that a raw, hand-typed SQL insert with a bogus reference gets rejected, and a delete of a still-referenced row gets blocked.

> One small reality check we like to surface: a reference is stored as the target's id — a UUID — but *as a string inside the JSON*, because JSON has no native UUID type. The target row's own id is a real UUID column; the pointer to it is text in the blob. That's why our checks compare `id::text = data ->> 'field'`.

## The pattern underneath all of this

Notice the shape repeating:

- Native database feature doesn't fit the "JSON + shared table + per-tenant" world →
- so we **generate the equivalent from the registry** (an expression index, or a registry-aware trigger) →
- and we enforce it **at the database**, not in app code.

Same philosophy as [Part 2](/posts/02-tenant-isolation-rls/)'s isolation: the guarantees live in the engine, generated from one description of what exists. The application doesn't have to remember the rules, because the database already knows them.

Next: we stop reasoning and start **measuring** — a load test that exposed a bottleneck we couldn't see, and taught us the difference between "a lot of data" and "slow."
