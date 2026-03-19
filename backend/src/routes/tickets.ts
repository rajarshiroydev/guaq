import { TicketPriority, TicketStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.js";

const createTicketSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  guestName: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  status: z.nativeEnum(TicketStatus).default(TicketStatus.New),
  priority: z.nativeEnum(TicketPriority),
  assignedTo: z.string().optional(),
});

const updateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedTo: z.string().nullable().optional(),
});

export const ticketsRouter = Router();

ticketsRouter.get("/", async (_req, res, next) => {
  try {
    const tickets = await prisma.ticket.findMany({
      orderBy: { updatedAt: "desc" },
    });
    res.json(tickets);
  } catch (error) {
    next(error);
  }
});

ticketsRouter.post("/", async (req, res, next) => {
  try {
    const payload = createTicketSchema.parse(req.body);
    const created = await prisma.ticket.create({
      data: {
        id: payload.id,
        roomId: payload.roomId,
        guestName: payload.guestName,
        category: payload.category,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        assignedTo: payload.assignedTo,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});

ticketsRouter.patch("/:id", async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    if (!ticketId) {
      throw new ApiError("Ticket id is required", 400);
    }

    const payload = updateTicketSchema.parse(req.body);
    if (Object.keys(payload).length === 0) {
      throw new ApiError("At least one field is required", 400);
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: payload.status,
        priority: payload.priority,
        assignedTo: payload.assignedTo,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});

ticketsRouter.delete("/:id", async (req, res, next) => {
  return next(new ApiError("Ticket deletion is disabled in this build", 405));
});
