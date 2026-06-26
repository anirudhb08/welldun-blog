---
series: "drafting-table"
title: "One engine, many schemas"
dek: "The core bet: a registry as source of truth, JSON for storage, and generated SQL views on top."
part: 1
date: 2026-06-26
readingTime: "8 min"
tags: ["architecture", "postgres", "jsonb"]
---

If every customer designs their own data model at runtime, the first question is brutally practical: **where do you put the data?**

Let's start with the obvious idea and watch it fall apart, because the failure points explain everything that follows.

## The tempting wrong answer: a table per object

A database organizes data into **tables** — grids with named, typed columns (like a spreadsheet with rules). The natural instinct is: when a customer defines a "Property," create a `property` table with the columns they chose.

This breaks badly here:

- **Untrusted users would trigger live schema changes.** Creating a table is a `CREATE TABLE` — a structural change to the database. Letting non-technical customers cause those, at runtime, is a security and stability minefield.
- **Table explosion.** A thousand customers with a hundred objects each is 100,000 tables. Databases get unhappy long before that.
- **Migrations become nightmares.** Every change to a customer's object is an `ALTER TABLE` on live data.

So we throw it out. But we keep one thing it got right: *analytics and queries love clean, typed columns.* Hold that thought.

## The bet: describe once, generate everything

Three pieces:

### 1. The registry — the single source of truth

The **registry** is a small set of ordinary tables that describe *what exists*: which entities a customer defined, what fields each has, and what type each field is. It's just metadata — data about data. Nothing customer-specific is hard-coded; the engine reads the registry at runtime.

```sql
-- a customer-defined kind of object
create table entity_types (
  id         uuid primary key,
  tenant_id  uuid not null,     -- which customer org owns it
  key        text not null,     -- machine name, e.g. 'property'
  label      text not null      -- display name, e.g. 'Property'
);

-- the fields belonging to an entity
create table fields (
  id             uuid primary key,
  entity_type_id uuid not null,
  key            text not null,  -- 'monthly_rent'
  type           text not null   -- a friendly type (see below)
);
```

Define an entity once, here, and everything else is generated from it.

### 2. Storage — one shared table of JSON

All records — every object, for every customer — live in **one** physical table. The actual field values go into a single column of type **JSONB** (Postgres's efficient, queryable JSON format).

```sql
create table records (
  id          uuid,
  tenant_id   uuid not null,     -- the owning customer
  entity_type text not null,     -- 'property', 'invoice', ...
  data        jsonb not null     -- { "name": "Maple Court", "monthly_rent": 1850 }
);
```

One table, no per-customer structure. A property and a solar job sit side by side, distinguished only by `entity_type` and the shape of their `data`. Adding a field to an entity is just… putting a new key in the JSON. No `ALTER TABLE`, ever.

The catch: a JSON blob is flexible but *untyped*. Analytics and clean queries still want real columns. Which is where the third piece comes in.

### 3. Views — typed columns, generated on demand

A **view** is a saved query that looks and acts like a table but is computed from other tables. For each entity, we generate one view that "unpacks" the JSON into clean, typed columns:

```sql
create view v_property as
select
  id,
  tenant_id,
  data ->> 'name'              as name,            -- text
  (data ->> 'monthly_rent')::numeric as monthly_rent,  -- number
  data ->> 'status'           as status
from records
where entity_type = 'property';
```

`data ->> 'name'` means "pull the `name` value out of the JSON as text." For numbers and dates we add a cast (`::numeric`) so the column has a real type. Now `v_property` behaves like a normal, typed table — even though underneath it's one shared JSON table.

This is the heart of the bet: **flexible JSON underneath for writes, clean typed views on top for reads.** You get the flexibility of "any shape" *and* the ergonomics of real columns, with zero user-authored schema changes.

## The piece that makes it safe: type whitelisting + sanitization

There's a sharp edge. The entity's `key` and field keys become part of SQL identifiers (the view's name, its column names) and a filter literal. If a customer could name a field `; drop table records; --`, that's a catastrophe.

So generation has two guardrails from day one:

- **A friendly-type whitelist.** Customers pick from a fixed menu — `text`, `number`, `currency`, `date`, `select`, `link`, etc. Each maps to a known SQL cast. Unknown types are rejected.
- **Identifier sanitization.** Keys must match a strict pattern (`[a-z][a-z0-9_]*`) and avoid reserved words. Anything else is rejected *before* it touches SQL.

No customer input is ever concatenated raw into a database command. The view-building code only assembles SQL from values that already passed these checks.

## What you get from this

The "define once, generate everything" pattern pays off repeatedly. From the same registry entry we generate:

- the **view** (typed read surface, above),
- the **validation schema** that checks writes,
- the **data-entry form** in the UI,
- the **API** for that entity,
- and later, the **analytics model**.

There's no per-entity code anywhere. One generic engine reads the registry and serves every entity for every customer. Adding a new entity is an API call, not a deployment.

## The trade we made

Let's be honest about the cost. JSON storage means values are stored as text inside the blob, so some things that are "free" with real columns (uniqueness, foreign keys, type enforcement) now take deliberate work. That's not a flaw to hide — it's the subject of two upcoming notes:

- **Part 2:** how we keep a thousand customers' data from ever bleeding into each other, enforced by the database itself.
- **Part 3:** how you get unique keys and relationships when the data lives in JSON and the schema was invented by a user.

Next: **tenant isolation** — and a view-related gotcha that, if we'd missed it, would have quietly leaked every customer's data.
