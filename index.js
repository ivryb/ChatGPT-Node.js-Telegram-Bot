import { Bot, InlineKeyboard } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { I18n } from "@grammyjs/i18n";

const { chatBotToken } = process.env;

import {
  botSession,
  getSessionKey,
  saveUser,
  canMakeRequest,
  isFreeUser,
  isAdmin,
  hasLocale,
  removeFreeRequest,
  enableUserSubscription,
  adminId,
  getPrettyUserId,
  isProMode,
  getFreeRequestsCount,
  setProMode,
  setBotMode,
  getBotMode,
  getSavedMessages,
  hasPaidRequests,
  saveUserMessages,
  clearSavedMessages,
  localeNegotiator,
  defaultLocale,
} from "./modules/db.js";

import { botModesList } from "./modules/modes.js";

import { chunkSubstr } from "./modules/utils.js";

import * as statsCollector from "./modules/statsCollector.js";

import { amp } from "./modules/amplitude.js";

import { getChatGPTResponse } from "./modules/openai.js";

const i18n = new I18n({
  directory: "locales",
  defaultLocale,
  localeNegotiator,
});

const bot = new Bot(chatBotToken);

bot.use(hydrateReply);

bot.use(sequentialize(getSessionKey));
bot.use(botSession);
bot.use(i18n);

const monthPrice = 50;
const sixMonthsPrice = 200;

const setBotCommands = async (ctx) => {
  await bot.api.setMyCommands([
    { command: "start", description: "Start the bot" },
    { command: "select", description: "Select the bot mode" },
    { command: "language", description: "Language selection" },
    { command: "help", description: "Contact the developer" },
    { command: "examples", description: "Examples of ChatGPT usage" },
    // { command: "balance", description: "Your balance" },

    // { command: 'stats', description: 'Bot statistics' },
    // { command: "settings", description: "Open settings" },
  ]);

  await bot.api.setMyCommands(
    [
      { command: "start", description: "Запустити бота" },
      { command: "select", description: "Обрати режим бота" },
      { command: "language", description: "Змінити мову" },
      { command: "help", description: `Зв'язатися з розробником` },
      { command: "examples", description: "Приклади використання ChatGPT" },
      // { command: "balance", description: "Переглянути баланс" },

      // { command: 'stats', description: 'Статистика користування ботом' },
      // { command: "settings", description: "Open settings" },
    ],
    { language_code: "uk" },
  );

  await bot.api.setChatMenuButton({ type: "commands" });

  console.log("Bot commands updated");
};

setBotCommands();

// Start & Locale selection

const sendStartMessages = async (ctx) => {
  await ctx.replyWithHTML(ctx.t("start"));
  await ctx.replyWithHTML(ctx.t("start-try"));
};

const sendSelectLanguageMessage = async (ctx, destination) => {
  await ctx.replyWithHTML("Select a language", {
    reply_markup: new InlineKeyboard()
      .text("English", `${destination}_en`)
      .row()
      .text("Українська", `${destination}_uk`)
      .row(),
  });
};

bot.command("start", async (ctx) => {
  saveUser(ctx, ctx.msg.from);

  statsCollector.saveActiveUser(ctx.session);

  if (hasLocale(ctx)) {
    await sendStartMessages(ctx);
  } else {
    await sendSelectLanguageMessage(ctx, "start");
  }

  amp.track({
    eventType: "Start",
    userId: ctx.session.userId,
    userProperties: ctx.session,
  });
});

bot.command("language", async (ctx) => {
  sendSelectLanguageMessage(ctx, "language");

  statsCollector.saveActiveUser(ctx.session);

  amp.track({
    eventType: "LanguageCommand",
    userId: ctx.session.userId,
    userProperties: ctx.session,
  });
});

const selectLocale = (locale, isStart) => async (ctx) => {
  ctx.session.locale = locale;

  await ctx.i18n.renegotiateLocale();

  if (isStart) {
    await sendStartMessages(ctx);
  } else {
    await ctx.replyWithHTML(ctx.t("language-changed"));
  }

  await ctx.answerCallbackQuery();

  amp.track({
    eventType: "SelectLanguage",
    userId: ctx.session.userId,
    userProperties: ctx.session,
    eventProperties: { locale },
  });
};

bot.callbackQuery("language_en", selectLocale("en"));
bot.callbackQuery("language_uk", selectLocale("uk"));
bot.callbackQuery("start_en", selectLocale("en", true));
bot.callbackQuery("start_uk", selectLocale("uk", true));

// Modes

bot.command("select", async (ctx) => {
  const locale = await ctx.i18n.getLocale();

  const keyboard = new InlineKeyboard();

  for (const botMode of botModesList) {
    keyboard
      .text(
        `${botMode.emoji} ${botMode[locale].title}`,
        `selectmode_${botMode.key}`,
      )
      .row();
  }

  await ctx.replyWithHTML(ctx.t("modes-list"), {
    reply_markup: keyboard,
  });
});

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  if (callbackData.includes("selectmode_")) {
    const userId = ctx.session.userId;

    const locale = await ctx.i18n.getLocale();

    const modeId = callbackData.replace("selectmode_", "");
    const botMode = botModesList.find((item) => item.key === modeId);
    const localeBot = botMode[locale];

    try {
      await ctx.replyWithHTML(
        ctx.t("you-selected-mode", {
          emoji: botMode.emoji,
          title: localeBot.title,
        }),
      );

      await ctx.replyWithHTML(
        `${botMode.emoji} <b>${localeBot.welcomeMessage}</b>`,
      );

      await setBotMode(ctx, { botMode });

      amp.track({
        eventType: "Set bot mode",
        userId,
        eventProperties: {
          botModeName: localeBot.title,
        },
      });
    } catch (error) {
      console.error("Error - update bot mode", error);

      await ctx.reply(
        "Something went wrong(\n\nPlease, try again or contact @ivryb",
      );
    }
  }

  await ctx.answerCallbackQuery();
});

// Other commands

bot.command("examples", async (ctx) => {
  await ctx.replyWithHTML(ctx.t("examples"));

  statsCollector.saveActiveUser(ctx.session);

  amp.track({
    eventType: "Examples",
    userId: ctx.session.userId,
    userProperties: ctx.session,
  });
});

bot.command("help", async (ctx) => {
  await ctx.replyWithHTML(ctx.t("help"));

  amp.track({
    eventType: "/help",
    userId: ctx.session.userId,
    userProperties: ctx.session,
  });
});

bot.command("balance", async (ctx) => {
  try {
    amp.track({
      eventType: "/balance",
      userId: ctx.session.userId,
      userProperties: ctx.session,
    });
  } catch (error) {
    console.error("/balance amp error", error);
  }

  const hasPaid = hasPaidRequests(ctx);
  const freeRequests = getFreeRequestsCount(ctx);

  if (hasPaid) {
    const paidDate = new Date(ctx.session.paidUntilDate);
    const paidUntil = paidDate.toLocaleDateString("en-GB");

    return await ctx.replyWithHTML(
      ctx.t("balancePaid", {
        paidUntil,
      }),
    );
  }

  return await ctx.replyWithHTML(
    ctx.t("balance", {
      freeRequests,
    }),
  );
});

bot.command("stats", async (ctx) => {
  await ctx.reply(
    `I'm fine) New requests: ${statsCollector.requestsCounter}${statsCollector.listLastActiveUsers()}`,
  );

  statsCollector.clearLastActivity();
});

bot.command("confirm", async (ctx) => {
  if (!isAdmin(ctx)) {
    await ctx.reply("You are not allowed to use that command!");
  } else {
    const [subscriberId, months] = ctx.match.split(" ").map(Number);

    const user = await enableUserSubscription(subscriberId, months);

    const paidDate = new Date(user.paidUntilDate);
    const dateString = paidDate.toLocaleDateString("en-GB");

    if (ctx.session.userId === subscriberId) {
      ctx.session.paidUntilDate = user.paidUntilDate;
    }

    await ctx.reply(
      `Subscription enabled successfuly, last date: ${dateString}`,
    );

    const userMessage = i18n.t(user.locale ?? "uk", "you-are-subscribed", {
      dateString,
    });

    await bot.api.sendMessage(subscriberId, userMessage);

    amp.track({
      eventType: "Subscribed",
      userId: subscriberId,
      userProperties: user,
      eventProperties: {
        months,
      },
    });
  }
});

// Pro mode

bot.command("pro", async (ctx) => {
  if (isAdmin(ctx)) {
    setProMode(ctx, true);

    await ctx.reply(
      "Pro mode is enabled, your message history will now be saved",
    );
  } else {
    await ctx.reply("You are not allowed to use that command!");
  }
});

bot.command("default", async (ctx) => {
  setProMode(ctx, false);
  clearSavedMessages(ctx);

  await ctx.reply(
    "Pro mode is disabled, message history will not be saved any more",
  );
});

bot.command("mode", async (ctx) => {
  const { isPro } = ctx.session;

  await ctx.reply(`Current mode: ${isPro ? "Pro" : "Default"}`);
});

bot.command("clear", async (ctx) => {
  clearSavedMessages(ctx);

  await ctx.reply("Message history is cleared");
});

// Messages
const sendTrialEndedMessage = async (ctx) => {
  const msg = ctx.t("trial-ended", {
    monthPrice,
    sixMonthsPrice,
  });

  await ctx.replyWithHTML(msg);

  // await ctx.replyWithHTML(msg, {
  //   reply_markup: new InlineKeyboard().text(
  //     ctx.t("subscribe"),
  //     "paymentInstructions",
  //   ),
  // });

  amp.track({
    eventType: "FreeRequestsEnded",
    userId: ctx.session.userId,
  });
};

bot.on("message", async (ctx) => {
  const user = ctx.msg.from;

  saveUser(ctx, user);

  statsCollector.saveActiveUser(ctx.session);

  if (!canMakeRequest(ctx)) {
    await sendTrialEndedMessage(ctx);
  } else {
    const fastReply = await ctx.reply(ctx.t("generating-response"));

    const botMode = getBotMode(ctx);
    const locale = await ctx.i18n.getLocale();

    const userMessage = ctx.message.text;

    const savedMessages = getSavedMessages(ctx);

    try {
      const { responseText, usage, requestTime } = await getChatGPTResponse({
        userMessage,
        personaPrompt: botMode[locale].prompt,
        savedMessages,
      });

      const chunks = chunkSubstr(responseText, 3950);

      for (const chunk of chunks) {
        await ctx.reply(`${botMode.emoji} ${chunk}`);
      }

      if (isFreeUser(ctx)) {
        removeFreeRequest(ctx);
      }

      if (isProMode(ctx)) {
        saveUserMessages(ctx, [
          { role: "user", content: userMessage },
          { role: "assistant", content: responseText },
        ]);
      }

      amp.track({
        eventType: "RequestMade",
        userId: ctx.session.userId,
        userProperties: ctx.session,
        eventProperties: {
          ...usage,
          requestTime,
        },
      });
    } catch (error) {
      if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
      } else {
        console.log(error.message);
      }

      await ctx.reply(ctx.t("request-error"));

      amp.track({
        eventType: "RequestError",
        userId: ctx.session.userId,
        userProperties: ctx.session,
      });
    }

    ctx.api.deleteMessage(ctx.chat.id, fastReply.message_id);
  }
});

bot.callbackQuery("paymentInstructions", async (ctx) => {
  const msg = ctx.t("payment-instructions", {
    monthPrice,
    sixMonthsPrice,
  });

  await ctx.replyWithHTML(msg, {
    disable_web_page_preview: true,
    reply_markup: new InlineKeyboard().text(ctx.t("i-paid"), "paymentCheck"),
  });

  await ctx.answerCallbackQuery();

  amp.track({
    eventType: "PaymentInstructions",
    userId: ctx.session.userId,
  });
});

bot.callbackQuery("paymentCheck", async (ctx) => {
  await ctx.replyWithHTML(ctx.t("checking-payment"));

  await ctx.answerCallbackQuery();

  await bot.api.sendMessage(
    adminId,
    `User payment reported: ${getPrettyUserId(ctx.session)}`,
  );
  await bot.api.sendMessage(adminId, ctx.session.userId);

  amp.track({
    eventType: "PaymentCheck",
    userId: ctx.session.userId,
  });
});

const runner = run(bot);

const stopRunner = () => runner.isRunning() && runner.stop();

process.once("SIGINT", stopRunner);
process.once("SIGTERM", stopRunner);
