import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error.js";
import {
  generateHelpAnswer,
  generateReviewReply,
  generateSimulatorReply,
} from "../services/groqService.js";

const simulatorSchema = z.object({
  history: z.array(z.string()).default([]),
  userMessage: z.string().min(1),
  stage: z.string().default("IDLE"),
  documents: z
    .array(z.object({ name: z.string(), description: z.string() }))
    .optional(),
  affiliates: z
    .array(
      z.object({ category: z.string(), label: z.string(), number: z.string() }),
    )
    .optional(),
});

const reviewSchema = z.object({
  reviewText: z.string().min(1),
  rating: z.number().min(1).max(5),
  guestName: z.string().min(1),
  signature: z.string().min(1),
});

const helpSchema = z
  .object({
    query: z.string().min(1).optional(),
    question: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.query || value.question), {
    message: "Either 'query' or 'question' is required",
  });

export const aiRouter = Router();

aiRouter.post("/simulator-reply", async (req, res, next) => {
  try {
    const payload = simulatorSchema.parse(req.body);
    const text = await generateSimulatorReply(
      payload.history,
      payload.userMessage,
      payload.stage,
      payload.documents,
      payload.affiliates,
    );
    res.json({ text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});

aiRouter.post("/review-reply", async (req, res, next) => {
  try {
    const payload = reviewSchema.parse(req.body);
    const text = await generateReviewReply(
      payload.reviewText,
      payload.rating,
      payload.guestName,
      payload.signature,
    );
    res.json({ text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});

aiRouter.post("/help-answer", async (req, res, next) => {
  try {
    const payload = helpSchema.parse(req.body);
    const text = await generateHelpAnswer(
      payload.query || payload.question || "",
    );
    res.json({ text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});
