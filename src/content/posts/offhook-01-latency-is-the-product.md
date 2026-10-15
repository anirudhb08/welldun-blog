---
series: "offhook"
title: "Latency is the product"
dek: "Where the time goes in one spoken turn, why the model's first token decides how a call feels, and the fixed cost we hadn't counted."
part: 1
date: 2026-10-15
readingTime: "8 min"
tags: ["latency", "voice", "llm", "pipecat"]
draft: false
---

The first time we got a call working end to end, everything was technically correct. The agent heard us, understood us and gave a sensible answer. It still felt broken, because after we stopped talking there was a pause long enough to wonder whether the line had dropped.

That pause is the whole problem. In a chat window, nobody notices if a reply takes two seconds. On a phone call, the same two seconds sounds like someone who didn't hear you. A voice agent can say exactly the right thing and still feel wrong because it said it late.

## Anatomy of one turn

Every time the caller finishes speaking, the agent runs a relay race. Offhook builds it on [Pipecat](https://github.com/pipecat-ai/pipecat), an open-source framework that passes audio and text between stages as a stream of small "frames":

```
caller speaks
  → VAD decides they've stopped        (voice activity detection)
  → STT finalises the transcript        (speech-to-text, Deepgram)
  → LLM produces its first token        (the model, e.g. Groq)
  → TTS produces its first audio        (text-to-speech, Cartesia)
  → audio travels back over the phone line
caller hears the reply
```

The number that matters is the time from the end of the caller's sentence to the first sound of the reply. Nobody experiences the stages separately; they only experience the gap.

Two details make this faster than the sum of its parts:

- **Everything streams.** The model's reply arrives a few tokens at a time, and the speech service starts on the first sentence while the model is still writing the rest. The caller hears the beginning of the answer before the end of it exists.
- **The first line skips the model entirely.** When a call connects, the agent's opener ("Hi, this is Alex from Acme Clinic…") is fixed text, so we send it straight to text-to-speech. We also add it to the conversation history as the agent's first turn, so the model knows it has already said hello and doesn't greet the caller a second time.

## Which stage is slow?

We turned on Pipecat's per-stage metrics, which log each service's time-to-first-byte (how long until it produces its first piece of output) on every turn. The pattern was consistent: speech-to-text and text-to-speech each took somewhere between tens and a few hundred milliseconds. When a turn felt slow, the language model was almost always the reason.

What matters for a language model here is **time-to-first-token** (TTFT): how long it takes to produce the first word of its reply, not how long the full reply takes. Because everything downstream streams, the first token is what starts the clock on audio.

Here is what we measured on this pipeline:

| Model | Time to first token |
| --- | --- |
| Groq · `llama-3.1-8b-instant` | **~310 ms** |
| Groq · `llama-3.3-70b-versatile` | ~430 ms |
| OpenRouter · free-tier models | 3–4 s |

Two things stand out.

**Where a model runs matters as much as which model it is.** The free OpenRouter models weren't necessarily worse at the task. They sit in shared queues, so the request waits before any work starts. That's harmless in a batch job and fatal on a phone call.

**A bigger model costs less than you'd think, if it's fast.** The 70B model was only about 120 ms slower to start than the 8B one, and noticeably smarter. For calls that need real judgement, that trade is often worth it. Offhook defaults to the 8B model and lets each agent choose.

> For voice, pick the model by time-to-first-token first and quality second. A brilliant answer that starts three seconds late loses to a good one that starts now.

## The fixed cost we hadn't counted

Once the model was fast, we expected the remaining gap to be small. Then we looked at the first stage.

Before anything else can happen, the agent has to decide that the caller has actually finished. Offhook uses Silero, a small voice-activity-detection model, to tell speech from silence. With Pipecat's defaults, the agent waits for **0.8 seconds of silence** before it treats the turn as over.

That is more than twice the model's time to first token, and it happens on every single turn, before any of the work above starts. We had optimised the 310 ms and left the 800 ms alone.

It isn't an easy number to lower, either. Wait too little and the agent jumps in every time someone pauses mid-sentence ("I'd like to book for… Tuesday"), which feels worse than a slow reply. Shorter waits need something smarter than "has it been quiet long enough". Newer turn-detection models look at what was said, not just at silence, to judge whether someone is finished. That's the next thing we want to measure in Offhook, and we'll write it up when we have numbers.

## Sounding human is part of latency too

A reply can be fast and still feel slow if it sounds robotic. People judge how responsive a voice is partly by how natural it sounds. Two changes mattered more than we expected:

- **The voice model.** Switching Cartesia from `sonic-2` to `sonic-3` made a bigger difference than any prompt change. It's far more expressive, and it accepts plain-language hints for tone ("positive and warm", "calm") and a speaking speed, which agents can set without code changes.
- **Writing for the ear.** Language models write as if for a page. Read aloud, that sounds like someone reading a press release. Every Offhook agent gets the same speaking rules added to its prompt: use contractions, keep turns to a sentence or two, ask one question at a time, acknowledge what the caller said ("got it", "no worries"), say numbers and dates the way a person would, and never use markdown. Short turns also help speed: a one-sentence reply reaches its first full sentence, and so its first audio, sooner.

## What we took away

1. **Measure the gap, not the stages.** The caller only feels the time from the end of their sentence to the start of the reply.
2. **Turn on per-stage metrics early.** Without them we would have kept tuning the wrong stage.
3. **Choose the model by its first token.** Where it runs (dedicated fast inference or a shared queue) can matter more than its size.
4. **Look for fixed costs.** The longest wait in our pipeline wasn't a model at all. It was a default setting deciding when the caller had stopped talking.

Offhook is open source, and the docs and quickstart are at [offhook.welldun.ai](https://offhook.welldun.ai). Set `VOICE_DEBUG_LOGGING=1` and the browser playground shows these per-stage timings live on your own calls.

Next up: **the phone part is the hard part**, where two carriers do the same job in surprisingly different ways.
