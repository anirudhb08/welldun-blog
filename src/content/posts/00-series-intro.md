---
series: "drafting-table"
title: "Building a platform where customers design their own database"
dek: "Why we're building a 'define-your-own-data' platform — and what this series will cover."
part: 0
date: 2026-06-26
readingTime: "5 min"
tags: ["intro", "architecture"]
---

Most software has one fixed shape. A property-management app knows about *properties*, *units*, and *leases*. A solar installer's app knows about *sites*, *jobs*, and *crews*. The shapes are baked in by the engineers who built them.

But what if the customer could design the shape themselves — define their own objects, fields, and relationships — and the platform just… handled it? Storage, validation, APIs, dashboards, all generated automatically, with no engineer writing code for that specific customer.

That's what we're building, and this series is the running field notebook.

## The one-paragraph pitch

A **multi-tenant** platform (multiple customer organizations share one running system) where each customer defines their own **entities** (think: kinds of objects, like "Property" or "Invoice"), their **fields**, and the **relationships** between them. From those definitions, the platform generates everything downstream. It's a self-serve, operational take on what Palantir calls an "ontology": instead of one fixed schema, every customer models their own world, and we maintain a single engine.

> The defining constraint: the people designing the data are *end customers* — non-technical and untrusted. That one fact rules out a lot of "obvious" approaches and shapes every decision that follows.

## Why this is interesting (and hard)

When the customer designs the schema at runtime, a bunch of comfortable assumptions disappear:

- You can't hand-write a database table per customer object — customers would be triggering live database changes, and you'd drown in tables.
- You can't hand-write validation, because you don't know the fields ahead of time.
- You can't hand-write the API, the forms, or the dashboards either.
- And you *still* have to keep every customer's data rigorously separate, enforce rules like "this field must be unique," and make it fast.

So almost everything has to be **generated from a description** rather than written by hand. That description — the "what exists" — we call the **registry**, and it's the spine of the whole system.

## What this series covers

We'll go in the order we actually built and discovered things:

1. **One engine, many schemas** — the core architectural bet: a registry as the single source of truth, data stored as flexible JSON, and typed database "views" generated on top. Why we *didn't* create a table per customer object.
2. **Keeping tenants apart** — how Postgres Row-Level Security makes data isolation a property of the database itself, not hopeful application code. Plus a genuinely surprising gotcha we hit with generated views.
3. **Unique keys and foreign keys… on JSON** — how you enforce real constraints and relationships when the data lives inside a JSON blob and the "schema" is invented by users.
4. **What a load test taught us** — the bottleneck we couldn't see until we measured it, why a 400-millisecond query became 0.3 milliseconds with one index, and the difference between "lots of data" and "slow."

## Who this is for

Anyone curious about how flexible, multi-tenant software is built — even if you've never run a database. Every piece of jargon gets a plain-English definition the first time it appears, and every claim we make, we'll back with something we actually built or measured.

Next up: **the architecture bet** — how one table and a pile of generated SQL lets a thousand customers each have their own schema.
