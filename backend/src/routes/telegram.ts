import { ChatSender, TicketPriority } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.js";
import {
  getTelegramUpdates,
  parseTelegramUpdate,
  setTelegramWebhook,
  TelegramIncomingMessage,
} from "../services/telegramService.js";

const setWebhookSchema = z.object({ url: z.string().url() });
let telegramUpdateOffset: number | undefined;
let telegramSyncInProgress = false;

const extractRoomId = (text: string, guestName: string): string => {
  const fromText = text.match(/room\s*#?\s*(\d{2,4})/i)?.[1];
  if (fromText) return fromText;
  const fromName = guestName.match(/room\s*(\d{2,4})/i)?.[1];
  return fromName || "N/A";
};

const detectServiceIntent = (
  text: string,
): {
  matched: boolean;
  category: string;
  priority: TicketPriority;
} => {
  const normalized = text.toLowerCase();

  const maintenanceTerms = [
    "ac",
    "air conditioner",
    "leak",
    "water",
    "wifi",
    "not working",
    "broken",
    "electric",
    "maintenance",
    "tv",
    "geyser",
  ];
  const housekeepingTerms = [
    "towel",
    "housekeeping",
    "clean",
    "bedsheet",
    "pillow",
    "blanket",
    "room service",
  ];
  const foodTerms = ["food", "breakfast", "dinner", "lunch", "menu"];
  const frontDeskTerms = ["checkout", "check out", "bill", "invoice", "folio"];

  const isMaintenance = maintenanceTerms.some((term) =>
    normalized.includes(term),
  );
  const isHousekeeping = housekeepingTerms.some((term) =>
    normalized.includes(term),
  );
  const isFood = foodTerms.some((term) => normalized.includes(term));
  const isFrontDesk = frontDeskTerms.some((term) => normalized.includes(term));

  if (!isMaintenance && !isHousekeeping && !isFood && !isFrontDesk) {
    return { matched: false, category: "", priority: TicketPriority.Low };
  }

  let category = "Concierge";
  if (isMaintenance) category = "Maintenance";
  else if (isHousekeeping) category = "Housekeeping";
  else if (isFood) category = "F&B";
  else if (isFrontDesk) category = "Front Desk";

  const criticalTerms = ["urgent", "asap", "emergency", "flood", "leaking"];
  const highTerms = ["not working", "broken", "immediately"];
  const isCritical = criticalTerms.some((term) => normalized.includes(term));
  const isHigh = highTerms.some((term) => normalized.includes(term));

  const priority = isCritical
    ? TicketPriority.Critical
    : isHigh
      ? TicketPriority.High
      : TicketPriority.Medium;

  return { matched: true, category, priority };
};

export const telegramRouter = Router();

const processIncomingTelegramMessage = async (
  incoming: TelegramIncomingMessage,
): Promise<void> => {
  const telegramChatId = BigInt(incoming.chatId);
  const guestName =
    incoming.firstName || incoming.username || `Telegram ${incoming.chatId}`;

  const conversation = await prisma.conversation.upsert({
    where: { telegramChatId },
    update: {
      guestName,
      telegramUsername: incoming.username,
      lastMsg: incoming.text,
      unread: { increment: 1 },
      status: "online",
    },
    create: {
      telegramChatId,
      guestName,
      telegramUsername: incoming.username,
      phone: incoming.username ? `@${incoming.username}` : "Telegram",
      lastMsg: incoming.text,
      unread: 1,
      status: "online",
    },
  });

  await prisma.message.create({
    data: {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      sender: ChatSender.user,
      text: incoming.text,
      timestamp: new Date(),
      status: "delivered",
    },
  });

  const detected = detectServiceIntent(incoming.text);
  if (detected.matched) {
    const ticketId = `T-${Date.now().toString().slice(-6)}`;
    await prisma.ticket.create({
      data: {
        id: ticketId,
        roomId: extractRoomId(incoming.text, guestName),
        guestName,
        category: detected.category,
        description: incoming.text,
        priority: detected.priority,
      },
    });
  }
};

telegramRouter.post("/webhook", async (req, res, next) => {
  try {
    const secret = req.header("x-telegram-bot-api-secret-token");
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      throw new ApiError("Invalid webhook secret", 401);
    }

    const incoming = parseTelegramUpdate(req.body);
    if (!incoming) {
      return res.status(202).json({ accepted: true });
    }

    await processIncomingTelegramMessage(incoming);

    res.json({ accepted: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});

telegramRouter.post("/sync", async (_req, res, next) => {
  if (telegramSyncInProgress) {
    return res.json({
      ok: true,
      processed: 0,
      pendingFetched: 0,
      skipped: true,
    });
  }

  telegramSyncInProgress = true;
  try {
    const updates = await getTelegramUpdates(telegramUpdateOffset);
    let processed = 0;
    let latestOffset = telegramUpdateOffset;

    for (const update of updates) {
      latestOffset = update.update_id + 1;
      const incoming = parseTelegramUpdate(update);
      if (!incoming) {
        continue;
      }
      await processIncomingTelegramMessage(incoming);
      processed += 1;
    }

    telegramUpdateOffset = latestOffset;
    res.json({ ok: true, processed, pendingFetched: updates.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes('error_code":409') ||
      message.includes("Conflict: terminated by other getUpdates request")
    ) {
      return res.json({
        ok: true,
        processed: 0,
        pendingFetched: 0,
        conflict: true,
      });
    }
    next(error);
  } finally {
    telegramSyncInProgress = false;
  }
});

telegramRouter.post("/set-webhook", async (req, res, next) => {
  try {
    const payload = setWebhookSchema.parse(req.body);
    await setTelegramWebhook(payload.url);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});
