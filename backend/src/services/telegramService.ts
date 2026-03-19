import { env } from "../config/env.js";

const API_BASE = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export interface TelegramIncomingMessage {
  chatId: string;
  text: string;
  username?: string;
  firstName?: string;
  messageId?: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: {
      id?: number;
      username?: string;
      first_name?: string;
    };
  };
}

export const parseTelegramUpdate = (
  payload: any,
): TelegramIncomingMessage | null => {
  const message = payload?.message;
  if (!message?.chat?.id || typeof message?.text !== "string") {
    return null;
  }

  return {
    chatId: String(message.chat.id),
    text: message.text,
    username: message.chat.username,
    firstName: message.chat.first_name,
    messageId: message.message_id,
  };
};

export const sendTelegramMessage = async (
  chatId: string,
  text: string,
): Promise<void> => {
  const response = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram send failed: ${details}`);
  }
};

export const setTelegramWebhook = async (url: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET || undefined,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram webhook setup failed: ${details}`);
  }
};

export const getTelegramUpdates = async (
  offset?: number,
): Promise<TelegramUpdate[]> => {
  const params = new URLSearchParams();
  params.set("timeout", "0");
  if (typeof offset === "number") {
    params.set("offset", String(offset));
  }

  const response = await fetch(`${API_BASE}/getUpdates?${params.toString()}`);

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Telegram getUpdates failed: ${details}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    result?: TelegramUpdate[];
    description?: string;
  };

  if (!payload.ok) {
    throw new Error(
      `Telegram getUpdates failed: ${payload.description || "unknown error"}`,
    );
  }

  return payload.result || [];
};
