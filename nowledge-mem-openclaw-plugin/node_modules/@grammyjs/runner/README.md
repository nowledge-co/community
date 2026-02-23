# <h1 align="center">grammY runner</h1>

---

While the core of [grammY](https://github.com/grammyjs/grammY) is extremely efficient, the package does not ship with a built-in mechanism for long polling at scale.
(It does scale well with webhooks, though.)

The grammY runner solves this by providing you with a sophisticated mechanism that can pull updates concurrently from the Telegram servers, and in turn execute your bot's middleware stack concurrently, all while catching errors, timeouts, and giving you full control over how much load is applied to your server.

## Do I Need This?

Use the grammY runner package if

- your bot needs to process a lot of updates (more than 1K/hour), or
- your bot performs long-running operations such as large file transfers.

Do **not** use grammY runner if

- you are just getting started with grammY, or
- your bot is running on webhooks.

## Quickstart

Here is a quickstart for you, but [the real documentation is here on the website](https://grammy.dev/plugins/runner.html).
The runner package has many more features, and they are documented there.

```bash
npm i @grammyjs/runner
```

Import `run` from `@grammyjs/runner`, and replace `bot.start()` with `run(bot)`. It is that simple. Done!

---

Okay okay, here is some example code:

```ts
import { Bot } from "grammy";
import { run } from "@grammyjs/runner";

// Create bot
const bot = new Bot("<token>");

// Add the usual middleware, yada yada
bot.on("message", (ctx) => ctx.reply("Got your message."));

// Run it concurrently!
run(bot);
```

## Concurrency Is Hard

grammY runner makes it trivial to have very high update throughput.
However, concurrency is generally very hard to get right, so please read [this section in the docs](https://grammy.dev/advanced/scaling.html#concurrency-is-hard).

## Resources

### [grammY runner in the grammY documentation](https://grammy.dev/plugins/runner.html)

—more verbose documentation about concurrency in grammY.

### [grammY runner API Reference](https://deno.land/x/grammy_runner/mod.ts)

—documentation of everything that grammY runner exports.

### [grammY Example Bots](https://github.com/grammyjs/examples)

—repository full of example bots, look our for those that demonstrate how to use grammY runner.
