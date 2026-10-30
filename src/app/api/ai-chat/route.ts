import Anthropic from "@anthropic-ai/sdk";
import { getCurrentProfile } from "@/lib/auth";

// War Room AI scout: an owner asks who to go for and Claude answers from a
// snapshot of their War Room (purse, max safe bid, category slots, squad gaps,
// the player on the block, the available pool). The snapshot is built in the
// browser, where the War Room already has all of it live. Switched on by
// setting ANTHROPIC_API_KEY on Vercel (auction day); until then it answers 503
// and the chat box says it goes live on auction day.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "claude-opus-5-5";
const MAX_SNAPSHOT = 60_000; // characters; the pool is trimmed in the browser to fit
const MAX_TURNS = 12;

const SYSTEM = `You are the AI scout in a franchise owner's War Room during a live cricket player auction (Shanti Devi Legend's League, Season 2, T20).

Your main job is to suggest the best possible player for this owner to buy, now and next. Every answer is grounded in the War Room snapshot that comes with each question: purse left, max safe bid, squad size and category slots, squad gaps, the player on the block with the current bid and which rivals can still afford him, the owner's wishlist, and the available pool with stats.

How to advise:
- Lead with a direct recommendation: the player's name, why he fits this squad (the gap he fills, his numbers), and a bid ceiling in rupees.
- Never recommend a bid above the max safe bid unless you say plainly that it uses the top-up, and never recommend a player whose category slot is full.
- When a player is on the block, answer first whether to bid on him and up to what amount, then name one or two fallbacks from the pool if the price runs away.
- Weigh value, not just the best index: a cheaper player who fills a real gap beats a star in a position the squad already has covered. Mention rivals who can still afford a player when it changes the advice.
- Use only players and numbers that appear in the snapshot. If something isn't there, say you don't have it.
- Be brief: owners read this on a phone mid-auction. Short paragraphs or a few bullets, rupees in Indian format (₹1,20,000).`;

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "offline" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { messages?: Turn[]; snapshot?: string } | null;
  const turns = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS);
  if (!turns.length || turns[0].role !== "user" || turns[turns.length - 1].role !== "user")
    return Response.json({ error: "Ask a question." }, { status: 400 });
  const snapshot = String(body?.snapshot ?? "").slice(0, MAX_SNAPSHOT);

  // The live snapshot rides on the latest question, so the instructions above stay a stable, cacheable prefix.
  const messages: Anthropic.MessageParam[] = turns.map((m, i) =>
    i === turns.length - 1
      ? { role: "user", content: `<war_room_snapshot>\n${snapshot}\n</war_room_snapshot>\n\n${m.content}` }
      : { role: m.role, content: m.content },
  );

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" }, // chat on a phone mid-auction: fast beats exhaustive
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  });

  const enc = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") ctrl.enqueue(enc.encode(ev.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") ctrl.enqueue(enc.encode("\n\nI can't help with that one. Ask me about players, bids or your squad."));
      } catch (err) {
        const msg =
          err instanceof Anthropic.RateLimitError
            ? "The AI scout is busy. Try again in a few seconds."
            : err instanceof Anthropic.AuthenticationError
              ? "The AI scout isn't connected (API key)."
              : "The AI scout couldn't answer just now. Try again.";
        console.error("ai-chat:", err);
        ctrl.enqueue(enc.encode(`\n\n${msg}`));
      } finally {
        ctrl.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
