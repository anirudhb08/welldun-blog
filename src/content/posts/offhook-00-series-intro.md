---
series: "offhook"
title: "Building an open-source API for AI phone calls"
dek: "Why we built Offhook, what makes an AI phone call hard, and what this series will cover."
part: 0
date: 2026-10-15
readingTime: "5 min"
tags: ["intro", "voice", "agents"]
draft: false
---

AI agents are good at reading and writing. Most of the real world still runs on phone calls: confirming an appointment, chasing a delivery, booking a table, checking whether a shop has something in stock. If agents are going to do useful work for people, at some point they have to pick up the phone.

So we built **Offhook**, an API that lets an agent place and answer real phone calls. It is open source, and you can run it on your own servers with your own provider keys. This series is the field notebook from building it.

## The one-paragraph pitch

You give Offhook an **agent** (instructions, a voice and a model) and a **phone number**. It dials, listens to the person on the other end, decides what to say, and says it, many times a second, until the call ends. Then it hands back a transcript, a structured outcome and a full log of what happened. Under the hood, every call is a pipeline of three AI services: **speech-to-text** (STT) turns the caller's voice into text, a **large language model** (LLM) decides the reply, and **text-to-speech** (TTS) turns the reply back into audio.

> Hosted products like Retell and Vapi already do this. Offhook is for teams who want to own the stack: their keys, their servers, their data.

## Why this is harder than it looks

Wiring STT, an LLM and TTS together takes an afternoon. Making it feel like a phone call takes much longer:

- **Silence feels like failure.** In a text chat, a two-second wait is fine. On a phone call, it feels as if the line has dropped. The whole pipeline has to start replying in well under a second.
- **The phone network is its own world.** Phone audio arrives as low-quality 8 kHz audio over a carrier's WebSocket. Every carrier has its own webhooks, its own XML dialect and its own surprises.
- **Models misbehave out loud.** When a small model writes a tool call as plain text instead of making it, a chat UI shows some odd characters. A phone call reads them aloud to a real person.
- **You are holding other people's keys.** Each customer brings their own Deepgram, Cartesia, LLM and carrier keys. Storing them safely is not optional.
- **Calls are real-world side effects.** A retried API request must never ring someone's phone twice. Every call also needs a clear record of what happened, because "the call failed" is not an answer anyone can act on.

## What this series covers

We'll go roughly in the order we ran into things:

1. **Latency is the product.** Where the time goes in a single spoken turn, why the LLM's time-to-first-token decides how the call feels, and what we measured across providers.
2. **The phone part is the hard part.** Plivo and Twilio side by side: answer documents, media streams, a carrier that silently drops query strings, and a trial account that waits for a keypress.
3. **When the model reads its tool calls aloud.** Building a streaming filter that removes tool-call syntax from text arriving a few characters at a time, without adding delay.
4. **Holding other people's keys.** Envelope encryption: what it is, and how Offhook stores each customer's provider keys so that a database dump on its own is useless.
5. **Postgres as the queue.** Async dialing with `FOR UPDATE SKIP LOCKED`, idempotency keys so a retry never double-dials, and webhooks that can't drift from the call log.

## Who this is for

Anyone curious about how voice agents work under the hood, whether or not you have built one. We'll define each piece of jargon the first time it appears, and back every claim with something we built or measured.

Offhook is open source under the Apache-2.0 license. The docs and quickstart are at [offhook.welldun.ai](https://offhook.welldun.ai).

Next up: **latency is the product**, or why the gap before the agent starts talking matters more than anything it says.
