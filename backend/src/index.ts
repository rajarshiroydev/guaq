import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { aiRouter } from "./routes/ai.js";
import { bookingsRouter } from "./routes/bookings.js";
import { healthRouter } from "./routes/health.js";
import { inboxRouter } from "./routes/inbox.js";
import { telegramRouter } from "./routes/telegram.js";
import { ticketsRouter } from "./routes/tickets.js";

const app = express();

app.use(
  cors({
    origin: "*", // allow all origins (including Vercel) while testing with local backend
    credentials: false,
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use(healthRouter);
app.use("/api/ai", aiRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/inbox", inboxRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/tickets", ticketsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`backend listening on port ${env.PORT}`);
});
