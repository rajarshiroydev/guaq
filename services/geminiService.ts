import { SimulationStage, DocumentFile, AffiliateContact } from "../types";

/**
 * ==============================================================================
 * 🏗️ ARCHITECTURE & MIGRATION NOTE (NEXT.JS SERVER ACTIONS)
 * ==============================================================================
 *
 * CURRENT STATE (SPA/Vite):
 * We use `process.env.API_KEY` for the environment.
 *
 * FUTURE STATE (Next.js App Router):
 * 1. Move logic to `app/actions/ai.ts` ('use server').
 * 2. Use `process.env.API_KEY`.
 * ==============================================================================
 */

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:8080";

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Request failed (${response.status}): ${details}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Base System Instruction for the AI Concierge.
 */
const BASE_INSTRUCTION = `
You are 'Guaq', the AI Concierge for Country Inn & Suites by Radisson, Manipal.
Your tone is professional, warm, luxurious, and helpful. 
You are concise because you are chatting on WhatsApp.

KEY BEHAVIORS:
1. **Welcome**: If the user says "Hi" or "Arrived", welcome them, offer the WiFi password (CountryInn_Guest / 123456).
2. **Pulse Check**: If asked about pulse check, ask for a rating 1-5. 
   - 1-3: Apologize deeply.
   - 4-5: Celebrate and ask for Google Review.
3. **Pre-Arrival**: If stage is PRE_ARRIVAL, say "Greetings from Country Inn! We are excited to welcome you tomorrow. To speed up your check-in, could you please share a photo of your ID card?"
4. **Checkout**: If user mentions "checkout", "leaving", or "bill", acknowledge it and assure them the Front Desk is preparing their folio.
5. **Documents**: Use the provided 'Knowledge Base' to answer specific questions about amenities, menus, or rules.
6. **Contacts**: If a guest asks for a taxi, doctor, or external service, provide the contact from the 'Affiliate Contacts' list.

Do not use markdown formatting like bolding with asterisks too heavily.
`;

const APP_DOCUMENTATION_CONTEXT = `
SYSTEM DOCUMENTATION FOR HELP CENTER AI:
You are the Help Desk Assistant for "GuaqAI", a Hospitality Operations Platform.
Use the following context to answer user questions about how to use the software.

1. **Dashboard**:
   - **Overview**: Shows Active Guests, Sentiment Score (0-5), and Pending Alerts.
   - **Guest Retention**: Table showing VIP/Loyal guests with "Action" buttons to send offers.
   - **Tabs**: Has sub-views for 'Review Automation', 'Dept Performance', and 'Direct Bookings'.

2. **Live Inbox**:
   - Central chat interface for WhatsApp/Telegram.
   - **Features**: Filter by Online/Critical, Assign Staff to chat, "Upsell Co-Pilot" sidebar for offers.
   - **Handover**: Typing in the box overrides the AI Bot.

3. **Bot Simulator**:
   - Tool to test the AI configuration.
   - **Stages**: PRE_ARRIVAL (collects IDs), CHECK_IN (WiFi), PULSE_CHECK (Mid-stay rating), POST_STAY (Review generation), SERVICE_RECOVERY (Apology).
   - **Controls**: Use buttons on the left to trigger these specific stages manually.

4. **Service Tickets**:
   - Kanban board (New, In Progress, Resolved).
   - **Auto-Creation**: The AI Bot automatically creates tickets if a guest chats "Towel", "AC Broken", etc.
   - **Drag & Drop**: Move cards to update status.

5. **Staff Roster**:
   - Manage shifts (Morning/Evening/Night).
   - Toggle "On Duty" status.
   - **RBAC**: Admin can manage all; Staff view is restricted.

6. **Campaigns**:
   - Broadcast marketing messages.
   - **Filters**: Age, Spend, Interests, Location.
   - **Stats**: Tracks Read Rate and Click Rate.

7. **Analytics**:
   - **Overview**: Floor Heatmap (Red rooms = low sentiment).
   - **Competitors**: Radar chart comparing Service, Price, Cleanliness vs 3 competitors.
   - **Food & Bev**: "Menu Engineering" (BCG Matrix) identifies Profitable items. "AI Designer" generates new menu layouts.

8. **Settings**:
   - **Branding**: Change Logo and Hotel Name.
   - **Reviews**: Configure Google/TripAdvisor deep links and Auto-Reply signature.
   - **Knowledge Base**: Upload PDFs (Spa Menu, Rules) for the Bot to read.
   - **Security**: Create Staff accounts and toggle permissions (View/Hide specific pages).

9. **Reviews**:
   - List of Google/TripAdvisor reviews.
   - **Auto-Pilot**: Button to generate and post AI replies to all pending reviews at once.
`;

/**
 * Generates a response for the Chatbot Simulator.
 */
export const generateBotResponse = async (
  history: string[],
  userMessage: string,
  stage: SimulationStage,
  documents: DocumentFile[] = [],
  affiliates: AffiliateContact[] = [],
): Promise<string> => {
  try {
    const stageWithHints =
      stage === SimulationStage.PULSE_CHECK
        ? `${stage}: user is responding to pulse check rating`
        : stage === SimulationStage.SERVICE_RECOVERY
          ? `${stage}: user is unhappy, use empathy`
          : stage === SimulationStage.PRE_ARRIVAL
            ? `${stage}: pre-arrival onboarding`
            : stage;

    const response = await postJson<{ text: string }>(
      "/api/ai/simulator-reply",
      {
        history,
        userMessage,
        stage: stageWithHints,
        documents: documents.map((d) => ({
          name: d.name,
          description: d.description,
        })),
        affiliates: affiliates.map((a) => ({
          category: a.category,
          label: a.label,
          number: a.number,
        })),
        baseInstruction: BASE_INSTRUCTION,
      },
    );

    return (
      response.text ||
      "I apologize, I'm having trouble connecting to the concierge service right now."
    );
  } catch (error) {
    console.error("AI API Error:", error);
    return "I'm having trouble connecting to the network right now. Please try again in a moment.";
  }
};

/**
 * Generates an automated reply for a Guest Review.
 */
export const generateReviewReply = async (
  reviewText: string,
  rating: number,
  guestName: string,
  signature: string,
): Promise<string> => {
  try {
    const response = await postJson<{ text: string }>("/api/ai/review-reply", {
      reviewText,
      rating,
      guestName,
      signature,
    });

    return response.text || "Thank you for your feedback.";
  } catch (e) {
    console.error("Review reply API Error:", e);
    return "Thank you for your review! We look forward to hosting you again.";
  }
};

/**
 * Generates a Help Center answer based on the query.
 */
export const generateHelpAnswer = async (query: string): Promise<string> => {
  try {
    const response = await postJson<{ text: string }>("/api/ai/help-answer", {
      query,
      context: APP_DOCUMENTATION_CONTEXT,
    });
    return (
      response.text || "I couldn't find an answer to that in the documentation."
    );
  } catch (e) {
    console.error("Help AI API Error:", e);
    return "I'm having trouble connecting to the knowledge base.";
  }
};
