import { Bot, InputFile } from "grammy/mod.ts";
import { Client, errors, StorageLocalStorage } from "mtkruto/mod.ts";
import { SECOND } from "./misc.ts";
import env from "./env.ts";

const client = new Client(
  new StorageLocalStorage("client"),
  env.API_ID,
  env.API_HASH,
);
const bot = new Bot(env.BOT_TOKEN);
const startTime = new Date().toUTCString();

const minutes = 15;
let timeout: ReturnType<typeof setTimeout> | null = null;
client.on("connectionState", (ctx) => {
  if (ctx.connectionState != "ready") return;
  if (timeout != null) clearTimeout(timeout);
  console.log(`stopping the client in ${minutes} minutes`);
  timeout = setTimeout(
    () => client.disconnect().then(() => console.log("stopped the client")),
    minutes * 60 * 1_000,
  );
});

async function disableJoinRequests(username: string) {
  if (!client.connected) {
    await client.start();
  }
  try {
    await client.disableJoinRequests(username);
    console.log("disabled join requests in", username);
    return true;
  } catch (err) {
    if (err instanceof errors.ChatNotModified) {
      console.log("join requests were already disabled in", username);
      return false;
    } else {
      throw err;
    }
  }
}

async function enableJoinRequests(username: string) {
  if (!client.connected) {
    await client.start();
  }
  try {
    await client.enableJoinRequests(username);
    console.log("enabled join requests in", username);
    return true;
  } catch (err) {
    if (err instanceof errors.ChatNotModified) {
      console.log("join requests were already enabled in", username);
      return false;
    } else {
      throw err;
    }
  }
}

const limit = 10;
const timeframe = 30 * SECOND;
function incr(username: string) {
  const count = `${username}_count`, lastReset_ = `${username}_lastReset`;

  let current = Number(localStorage.getItem(count)) || 0;
  if (!current) {
    localStorage.setItem(lastReset_, String(Date.now()));
  } else {
    const lastReset = Number(localStorage.getItem(lastReset_) || 0);
    if (lastReset && Date.now() - lastReset >= timeframe) {
      current = 0;
      localStorage.removeItem(lastReset_);
    }
  }
  ++current;
  localStorage.setItem(`${username}_count`, String(current));
  return current;
}
function reset(username: string) {
  localStorage.removeItem(`${username}_count`);
  localStorage.removeItem(`${username}_lastReset`);
}

bot.catch((ctx) => {
  const text = Deno.inspect(ctx.error, {
    colors: false,
    depth: Infinity,
    iterableLimit: Infinity,
  });
  if (text.length <= 4096) {
    bot.api.sendMessage(
      env.LOG_CHAT_ID,
      text,
      { entities: [{ type: "code", offset: 0, length: text.length }] },
    )
      .catch(console.error);
  } else {
    bot.api.sendDocument(env.LOG_CHAT_ID, new InputFile(text, "error"))
      .catch(console.error);
  }
});

bot.chatType("supergroup")
  .on("message", async (ctx, next) => {
    if (ctx.chat.id == env.LOG_CHAT_ID) return await next();
    const username = ctx.chat.username;
    if (!username) {
      return;
    }
    if (incr(username) >= limit) {
      const then = performance.now();
      const result = await enableJoinRequests(username);
      reset(username);
      if (result) {
        await ctx.reply(
          `Join requests enabled in ${performance.now() - then}ms.`,
        );
      } else {
        await ctx.reply("Join requests are already enabled.");
      }
    }
  });

const logChat = bot.filter((ctx) => ctx.chat?.id === env.LOG_CHAT_ID);
logChat.command(
  "status",
  async (ctx) => {
    await ctx.reply(`Up since ${startTime}.`);
  },
);
logChat.command("disable", async (ctx) => {
  const username = ctx.match;
  if (!username) return;
  const then = performance.now();
  const result = await disableJoinRequests(username);
  if (result) {
    await ctx.reply(
      `Join requests disabled for ${username} in ${
        performance.now() - then
      }ms.`,
    );
  } else {
    await ctx.reply(`Join requests are already disabled for ${username}.`);
  }
});

await client.start();
await bot.start({
  drop_pending_updates: true,
  allowed_updates: ["chat_member", "message"],
}); // should remove drop_pending_updates after tests are done
