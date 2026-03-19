import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.js";
import { sendTelegramMessage } from "../services/telegramService.js";

const sendSchema = z.object({
  conversationId: z.number().int().positive(),
  text: z.string().min(1),
});

export const inboxRouter = Router();

inboxRouter.get("/conversations", async (_req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        guestName: true,
        status: true,
        avatarBg: true,
        lastMsg: true,
        unread: true,
        telegramUsername: true,
        phone: true,
        assignedTo: true,
        telegramChatId: true,
        updatedAt: true,
      },
    });

    res.json(
      conversations.map((c: (typeof conversations)[number]) => ({
        id: c.id,
        name: c.guestName,
        status: c.status,
        avatarBg: c.avatarBg,
        lastMsg: c.lastMsg || "",
        time: c.updatedAt.toISOString(),
        unread: c.unread,
        phone: c.phone || c.telegramUsername || "Telegram",
        assignedTo: c.assignedTo,
        telegramChatId: c.telegramChatId.toString(),
      })),
    );
  } catch (error) {
    next(error);
  }
});

inboxRouter.get("/messages/:conversationId", async (req, res, next) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (Number.isNaN(conversationId)) {
      throw new ApiError("Invalid conversation id", 400);
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: "asc" },
    });

    res.json(
      messages.map((m: (typeof messages)[number]) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
        status: m.status || "sent",
        isMedia: m.isMedia,
        mediaUrl: m.mediaUrl,
      })),
    );
  } catch (error) {
    next(error);
  }
});

inboxRouter.post("/messages/send", async (req, res, next) => {
  try {
    const payload = sendSchema.parse(req.body);
    const conversation = await prisma.conversation.findUnique({
      where: { id: payload.conversationId },
    });
    if (!conversation) {
      throw new ApiError("Conversation not found", 404);
    }

    let deliveryStatus: "sent" | "failed" = "sent";
    let deliveryError: string | null = null;

    try {
      await sendTelegramMessage(
        conversation.telegramChatId.toString(),
        payload.text,
      );
    } catch (error) {
      deliveryStatus = "failed";
      deliveryError =
        error instanceof Error ? error.message : "Telegram delivery failed";
    }

    const message = await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        sender: "bot",
        text: payload.text,
        timestamp: new Date(),
        status: deliveryStatus,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMsg: payload.text, unread: 0 },
    });

    res.status(201).json({
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestamp: message.timestamp,
      status: message.status || "sent",
      deliveryError,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});
