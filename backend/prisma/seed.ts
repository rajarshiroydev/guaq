import {
  BookingStatus,
  ChatSender,
  PrismaClient,
  ReviewStatus,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.staffMember.upsert({
    where: { id: "S-01" },
    update: {},
    create: {
      id: "S-01",
      name: "Rajesh Kumar",
      role: "Front Desk",
      email: "rajesh@hotel.com",
      phone: "9876543210",
      currentShift: "Morning",
      isOnDuty: true,
      avatarBg: "bg-blue-600",
    },
  });

  await prisma.ticket.upsert({
    where: { id: "T-1024" },
    update: {},
    create: {
      id: "T-1024",
      roomId: "304",
      guestName: "Mr. John Doe",
      category: "Maintenance",
      description: "AC unit leaking water on nightstand",
      status: TicketStatus.New,
      priority: TicketPriority.Critical,
    },
  });

  await prisma.review.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      guestName: "Alice Morgan",
      rating: 5,
      date: new Date("2024-10-26"),
      platform: "google",
      comment: "Absolutely loved the rooftop pool! Great service by Rajesh.",
      status: ReviewStatus.Pending,
    },
  });

  await prisma.roomBooking.upsert({
    where: { id: "B-1001" },
    update: {},
    create: {
      id: "B-1001",
      roomId: "304",
      guestName: "Rajarshi Roy",
      guestPhone: "+919999999999",
      guestEmail: "rajarshi@example.com",
      checkIn: new Date("2026-03-19T12:00:00.000Z"),
      checkOut: new Date("2026-03-22T10:00:00.000Z"),
      adults: 2,
      children: 0,
      status: BookingStatus.Confirmed,
      source: "telegram",
      totalAmount: 18000,
      paidAmount: 5000,
      notes: "Late check-in expected around 9 PM",
    },
  });

  const convo = await prisma.conversation.upsert({
    where: { telegramChatId: BigInt(1000000001) },
    update: {},
    create: {
      telegramChatId: BigInt(1000000001),
      guestName: "Room 304 (John)",
      status: "critical",
      avatarBg: "bg-indigo-600",
      lastMsg: "The AC is dripping water on the bed.",
      unread: 1,
      phone: "@john_demo",
    },
  });

  await prisma.message.upsert({
    where: { id: "seed-msg-1" },
    update: {},
    create: {
      id: "seed-msg-1",
      conversationId: convo.id,
      sender: ChatSender.user,
      text: "Hi, the AC in my room is leaking water onto the nightstand.",
      timestamp: new Date(Date.now() - 120000),
      status: "read",
    },
  });

  await prisma.message.upsert({
    where: { id: "seed-msg-2" },
    update: {},
    create: {
      id: "seed-msg-2",
      conversationId: convo.id,
      sender: ChatSender.bot,
      text: "We are sorry about this. I have notified maintenance immediately.",
      timestamp: new Date(Date.now() - 60000),
      status: "read",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
