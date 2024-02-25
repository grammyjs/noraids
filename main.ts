import { Bot, InputFile } from "grammy/mod.ts";
import {
  APP_VERSION,
  Client,
  errors,
  StorageLocalStorage,
} from "mtkruto/mod.ts";
import { display, HOUR, MINUTE } from "./misc.ts";
import env from "./env.ts";

const client = new Client(
  new StorageLocalStorage("client"),
  env.API_ID,
  env.API_HASH,
  { appVersion: `${APP_VERSION} (noraids${env.APP_VERSION_SUFFIX})` },
);
const bot = new Bot(env.BOT_TOKEN);
const startTime = new Date().toUTCString();

let timeout: ReturnType<typeof setTimeout> | null = null;
const minutes = 15;
client.on("connectionState", (ctx) => {
  if (ctx.connectionState != "ready") return;
  if (timeout != null) clearTimeout(timeout);
  console.log(`stopping the client in ${minutes} minutes`);
  timeout = setTimeout(
    () => client.disconnect().then(() => console.log("stopped the client")),
    minutes * MINUTE,
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

const timestamps = new Map<string, number[]>();
const indexes = new Map<string, number>();
const limit = 30;
const timeframe = 1 * HOUR;
function incr(username: string) {
  username = username.toLowerCase();
  const timestamps_ = (() => {
    const v = timestamps.get(username);
    if (v) {
      return v;
    } else {
      const v = new Array<number>(limit).fill(0);
      timestamps.set(username, v);
      return v;
    }
  })();
  const index = indexes.get(username) ?? 0;
  const current = timestamps_[index];
  if (Date.now() - current <= timeframe) {
    return timestamps_.filter((v) => v).sort((a, b) => a - b);
  } else {
    timestamps_[index] = Date.now();
  }
  indexes.set(username, (index + 1) % timestamps_.length);
  return null;
}
function reset(username: string) {
  username = username.toLowerCase();
  timestamps.delete(username);
  indexes.delete(username);
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
  .on("chat_member", async (ctx, next) => {
    if (ctx.chat.id == env.LOG_CHAT_ID) return await next();
    const username = ctx.chat.username;
    if (!username) {
      return;
    }
    if (
      ctx.chatMember.old_chat_member.status != "left" ||
      ctx.chatMember.new_chat_member.status != "member"
    ) {
      return;
    }
    const result = incr(username);
    if (result != null) {
      const then = performance.now();
      const enabled = await enableJoinRequests(username);
      reset(username);
      if (enabled) {
        await ctx.reply(
          `Join requests enabled in ${performance.now() - then}ms.`,
        );
        await ctx.reply(`<b>JOIN TIMESTAMPS</b>\n${display(result)}`, {
          parse_mode: "HTML",
        });
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
});
