import Groq from "groq-sdk";
import { env } from "../config/env.js";

const client = new Groq({ apiKey: env.GROQ_API_KEY });

const BASE_INSTRUCTION = `You are 'Guaq', the AI Concierge for a hospitality operations app.
Keep responses concise, professional, and guest-friendly.
Avoid markdown-heavy formatting.`;

const HELP_INSTRUCTION = `You are a help assistant for a hotel operations dashboard.
Answer clearly and practically for product usage questions.`;

export const generateSimulatorReply = async (
  history: string[],
  userMessage: string,
  stage: string,
  documents: Array<{ name: string; description: string }> = [],
  affiliates: Array<{ category: string; label: string; number: string }> = [],
): Promise<string> => {
  const context = [
    documents.length > 0
      ? `Knowledge base: ${documents.map((d) => `${d.name} (${d.description})`).join(", ")}`
      : "",
    affiliates.length > 0
      ? `Affiliate contacts: ${affiliates.map((a) => `${a.category}: ${a.label} ${a.number}`).join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.6,
    messages: [
      { role: "system", content: BASE_INSTRUCTION },
      {
        role: "user",
        content: `Stage: ${stage}\nConversation history:\n${history.join("\n")}\n\nUser: ${userMessage}\n\n${context}`,
      },
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "I am having trouble right now. Please try again."
  );
};

export const generateReviewReply = async (
  reviewText: string,
  rating: number,
  guestName: string,
  signature: string,
): Promise<string> => {
  const completion = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: "You write short professional hotel review replies.",
      },
      {
        role: "user",
        content: `Guest: ${guestName}\nRating: ${rating}/5\nReview: ${reviewText}\n\nWrite a personalized reply and sign off with ${signature}.`,
      },
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "Thank you for your feedback."
  );
};

export const generateHelpAnswer = async (query: string): Promise<string> => {
  const completion = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: HELP_INSTRUCTION },
      { role: "user", content: query },
    ],
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "I could not find an answer right now."
  );
};
