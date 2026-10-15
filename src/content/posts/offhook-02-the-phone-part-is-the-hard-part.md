---
series: "offhook"
title: "The phone part is the hard part"
dek: "What actually happens when an API places a phone call, and five ways two carriers doing the same job still managed to surprise us."
part: 2
date: 2026-10-15
readingTime: "8 min"
tags: ["telephony", "twilio", "plivo", "voice"]
draft: true
---

When people imagine building a voice agent, they picture the AI: the speech recognition, the model, the voice. That part took us an afternoon to wire together. Getting a real phone to ring, connect and hang up cleanly took far longer.

A phone call to an AI agent is a conversation between three parties that don't share much: your server, a **carrier** (the company that connects you to the phone network, like Twilio or Plivo), and someone's phone. Most of the surprises live in the gaps between them.

## What actually happens on a call

Here is the full round trip when Offhook places an outbound call:

```
1. Offhook  ──REST: "call +1 415 555 0123"──▶  carrier
2. carrier dials the number; the person picks up
3. carrier  ──"answered, what now?"──▶  Offhook's answer URL
4. Offhook  ──XML: "open an audio stream to wss://…"──▶  carrier
5. carrier  ══ two-way audio over a WebSocket ══  Offhook
              (caller's voice in, agent's voice out)
6. call ends
7. carrier  ──"call ended, and here's why"──▶  Offhook's status URL
```

Two things about this surprised us at first.

**The carrier calls you, not the other way round.** After the first request, you never ask the carrier anything. It reaches back into your server twice: once when the call is answered, to find out what to do, and once when it ends. So your server needs a public HTTPS address the carrier can reach. In local development that means a tunnel such as ngrok, whose address changes every time it restarts.

**Phone audio isn't web audio.** The stream carries **mu-law** audio at **8 kHz**: an old telephone encoding that keeps only the frequencies speech needs and squeezes each sample into 8 bits. It's much lower quality than what a browser microphone gives you. It also never stops, even when nobody is talking, so Offhook runs voice activity detection (deciding when someone is speaking) directly on the phone stream. In the browser playground, that detection sits further down the pipeline instead.

## Two carriers, same job

Offhook supports Plivo and Twilio. On paper they do the same thing. In practice almost every step is slightly different:

| | Plivo | Twilio |
| --- | --- | --- |
| Start a call | JSON `POST …/Call/` | Form-encoded `POST …/Calls.json` |
| Answer document | PlivoXML `<Stream>` | TwiML `<Connect><Stream>` |
| Query string on the stream URL | Kept | **Dropped** |
| First message on the stream | `start` | `connected`, then `start` |
| Why the call ended | `HangupCause`, e.g. `USER_BUSY` | `CallStatus`, e.g. `busy` |
| Trial accounts | — | **Wait for a keypress first** |

None of these differences is hard on its own. Together, they are why Offhook keeps every carrier behind one small interface with five methods: place a call, write the answer document, read the start of the stream, build the audio transport, and verify the carrier's signature. Everything else in Offhook only talks to that interface, so adding a carrier means one new file and registering its name, not changes across the codebase.

Here are the five surprises that taught us to do it that way.

### 1. The vanishing token

The carrier opens the audio WebSocket into your server, and you have to know which call it belongs to and that it really is the carrier. You can't ask a carrier to send your API key. So for each call Offhook creates a random, single-use **session token** and puts it in the stream URL as a query parameter: `wss://…/v1/telephony/stream?session_token=…`. When the stream opens, Offhook looks the token up, finds the call, and marks the token as used so nobody can replay it.

That worked on Plivo straight away. On Twilio every stream was rejected, because Twilio quietly drops the query string from the stream URL. The token has to travel another way, as a `<Parameter>` inside the TwiML:

```xml
<Response>
  <Connect>
    <Stream url="wss://your-host/v1/telephony/stream">
      <Parameter name="session_token" value="…" />
    </Stream>
  </Connect>
</Response>
```

It then arrives inside the stream's first real message, in a field called `customParameters`. Offhook now checks both places.

### 2. The message before the message

Plivo's first WebSocket message is `start`, which carries the IDs Offhook needs. Twilio sends a `connected` message first, and `start` only after it. Code that expected the first message to be the useful one worked on one carrier and failed on the other. The fix is simple: read messages until one says `start`, and ignore anything before it.

### 3. Same hang-up, different words

When a call ends, both carriers tell you why, in their own vocabulary. Plivo says `USER_BUSY`, `NO_ANSWER` or `UNALLOCATED_NUMBER`. Twilio says `busy`, `no-answer` or `canceled`. If Offhook passed those through, everyone using it would need to know both vocabularies.

So Offhook normalises them (upper case, hyphens become underscores) and maps them to a short list of error codes that never change: `busy`, `no_answer`, `rejected`, `invalid_number`, `carrier_error`. Your code checks for `no_answer` without caring which carrier you're on.

### 4. The call that "completed" without anyone talking

On a Twilio trial account, the person you call first hears a recorded message asking them to press a key. Only then does Twilio fetch your answer URL. If they don't press anything, Twilio eventually reports the call as `completed`, a perfectly normal ending, even though your agent never said a word.

From Offhook's side, that call was stuck at `dialing` forever: the audio stream never opened, so nothing moved it forward. Now, when the carrier's "call ended" report arrives for a call that never got its audio stream, Offhook ends the call itself. If the carrier gave a reason, that reason becomes the error code. If it reported a clean finish, the code is `no_media`: the carrier connected, but no conversation ever happened. That way a call never sits at `dialing` with no explanation.

### 5. The address that changed under us

The most common failure during development wasn't a carrier quirk at all. Offhook builds the answer URL from `PUBLIC_BASE_URL` when the worker dials. Restart ngrok and you get a new address; forget to update it and the carrier calls a dead tunnel. The person you're calling hears "an application error has occurred", and the call never leaves `dialing`.

Two lessons came from this. First, both the API and the worker read the address when they start, so changing it means restarting both: the worker hands the address to the carrier, and the API answers on it. Second, Offhook builds callback URLs only from that one setting, never from incoming request headers, so a misconfigured proxy can't send carrier traffic somewhere else.

## What we took away

1. **Put each carrier behind the same narrow interface.** The differences are small but everywhere. Keep them in one file per carrier.
2. **Don't assume a carrier will pass your data back unchanged.** Test how your call identifier survives each round trip, on every carrier.
3. **Translate carrier vocabulary into your own.** Stable error codes are what make a call log useful to the people reading it.
4. **Use the carrier's final report to close calls.** If your own pipeline never started, that report is the only signal you'll get.

Offhook's docs, including the full list of error codes, are at [offhook.welldun.ai](https://offhook.welldun.ai/docs/errors/).

Next up: **when the model reads its tool calls aloud**, and the streaming filter that stops a small model from speaking its own function calls to the caller.
