import { BookingStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.js";

const createBookingSchema = z
  .object({
    id: z.string().min(1),
    roomId: z.string().min(1),
    guestName: z.string().min(1),
    guestPhone: z.string().min(1).optional(),
    guestEmail: z.string().email().optional(),
    checkIn: z.coerce.date(),
    checkOut: z.coerce.date(),
    adults: z.number().int().min(1).default(1),
    children: z.number().int().min(0).default(0),
    status: z.nativeEnum(BookingStatus).default(BookingStatus.Confirmed),
    source: z.string().default("direct"),
    totalAmount: z.number().min(0),
    paidAmount: z.number().min(0).default(0),
    notes: z.string().optional(),
  })
  .refine((value) => value.checkOut > value.checkIn, {
    message: "checkOut must be later than checkIn",
    path: ["checkOut"],
  });

const updateStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

export const bookingsRouter = Router();

bookingsRouter.get("/", async (_req, res, next) => {
  try {
    const bookings = await prisma.roomBooking.findMany({
      orderBy: { checkIn: "desc" },
    });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

bookingsRouter.post("/", async (req, res, next) => {
  try {
    const payload = createBookingSchema.parse(req.body);

    const booking = await prisma.roomBooking.create({
      data: {
        id: payload.id,
        roomId: payload.roomId,
        guestName: payload.guestName,
        guestPhone: payload.guestPhone,
        guestEmail: payload.guestEmail,
        checkIn: payload.checkIn,
        checkOut: payload.checkOut,
        adults: payload.adults,
        children: payload.children,
        status: payload.status,
        source: payload.source,
        totalAmount: payload.totalAmount,
        paidAmount: payload.paidAmount,
        notes: payload.notes,
      },
    });

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});

bookingsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new ApiError("Booking id is required", 400);
    }

    const payload = updateStatusSchema.parse(req.body);

    const booking = await prisma.roomBooking.update({
      where: { id },
      data: { status: payload.status },
    });

    res.json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ApiError(error.message, 400));
    }
    next(error);
  }
});
