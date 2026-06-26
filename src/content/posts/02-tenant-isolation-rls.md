---
series: "drafting-table"
title: "Keeping tenants apart with Row-Level Security"
dek: "How Postgres makes data isolation a property of the database — and the view gotcha that nearly leaked everything."
part: 2
date: 2026-06-26
readingTime: "8 min"
tags: ["security", "postgres", "multi-tenancy"]
---

Every customer's records sit in **one shared table** (see [Part 1](/posts/01-the-architecture-bet/)). That's efficient — and terrifying. One wrong `WHERE` clause and Northwind Properties could see Helios Solar's data. In a multi-tenant system, that's the worst bug there is.

The usual defense is discipline: "always remember to filter by the customer's id." But discipline fails. Someone forgets a filter in one query out of hundreds, and you've got a breach. We wanted isolation to be a property of the **database**, not of careful coding.

Postgres has exactly the tool: **Row-Level Security**.

## What Row-Level Security (RLS) is

**Row-Level Security** lets you attach a rule to a table that silently filters which rows a query can even see or touch. Once it's on, *every* query against that table is automatically constrained — there's no way to "forget."

Two ingredients:

**1. A per-request setting that says who's asking.** Each request runs inside a database transaction that first declares the current customer:

```sql
begin;
set local app.tenant_id = '<the verified customer id>';
-- ...every query here is now scoped to that customer...
commit;
```

`set local` ties the value to this one transaction, so connection reuse can't leak it into the next request.

**2. A policy on the table** that compares each row to that setting:

```sql
alter table records enable row level security;

create policy tenant_isolation on records
  using      (tenant_id = current_setting('app.tenant_id')::uuid)   -- which rows are visible
  with check (tenant_id = current_setting('app.tenant_id')::uuid);  -- which rows you may write
```

Now a query like `select * from records` quietly becomes "...where this row belongs to the current customer." A buggy or even malicious query *cannot* return another customer's rows. The boundary is enforced one layer below the application.

> Where does the customer id come from? Never from the request body — only from a verified login token. The user proves who they are; the app sets `app.tenant_id` from that proof; the database enforces the rest. Each customer organization maps to one tenant.

## Belt and suspenders: a locked-down database role

RLS only bites if you connect as a role that's subject to it. So the application connects as a **non-superuser** role with no special bypass powers — it can read and write rows, but cannot escape the policy. A separate, more privileged role handles the structural work (creating views, etc.). The request path literally lacks the authority to cross tenants.

## The gotcha that nearly leaked everything

Here's the subtle one — the kind of thing you only catch by testing isolation explicitly.

Recall from Part 1 that customers read their data through **views** (`v_property` and friends). A view in Postgres runs with the **permissions of whoever owns the view**, not whoever runs the query. Our views are owned by that privileged role.

See the problem? When a customer queries `v_property`, the underlying read of the shared `records` table happens *as the privileged owner* — and **table owners are exempt from RLS by default.** So the policy we so carefully wrote would simply… not apply when reading through a view. Every customer would see every customer's rows. The exact disaster we were defending against, reintroduced by the read layer.

The fix is one keyword:

```sql
alter table records force row level security;
```

`FORCE` makes the policy apply to **everyone**, including the table's owner. Now even when the view reads `records` as the privileged owner, the `app.tenant_id` filter still kicks in. Isolation holds through the views.

We pinned this down with a test that does the most paranoid possible check: connect as the locked-down app role, set tenant A's context, and query the raw shared table *and* the view directly — confirm you see only A's rows; switch to tenant B — confirm you see only B's. Proven at the database, not assumed from the app.

## Why prove it at the database, not the app?

Because every other layer inherits the guarantee. The API, the background jobs, the analytics queries, a future feature written by someone who's never read this post — all of them go through the same tables, and all of them are scoped automatically. You verify isolation *once*, at the bottom, and everything above it is safe by construction.

That's the theme of this whole project: **make the safety a property of the system, not a habit of the programmer.**

Next: now that data is safely separated, how do you enforce real rules on it — like "email must be unique" and "this invoice points to a real customer" — when the data lives inside JSON?
