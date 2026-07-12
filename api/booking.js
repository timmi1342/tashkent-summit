// Vercel Serverless Function — receives a booking and sends it to Telegram.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method not allowed" });

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const clip = (v, n) => (v == null ? "" : String(v)).slice(0, n);
    const name = clip(b.name, 120);
    const email = clip(b.email, 120);
    const phone = clip(b.phone, 60);
    const tier = clip(b.tier, 60);
    const date = clip(b.date, 40);
    const guests = clip(b.guests, 10);
    const diet = clip(b.diet, 60);
    const note = clip(b.note, 500);
    const ref = clip(b.ref, 40);
    const deposit = clip(b.deposit, 40);
    const balance = clip(b.balance, 40);
    const rate = clip(b.rate, 20);

    if (!name || !email) return res.status(400).json({ ok: false, error: "missing fields" });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return res.status(500).json({ ok: false, error: "server not configured" });

    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const text =
      `🏔 <b>New booking — Tashkent Summit</b>\n` +
      `Ref: <code>${esc(ref)}</code>\n\n` +
      `👤 <b>${esc(name)}</b>\n` +
      `✉️ ${esc(email)}\n` +
      `📱 ${esc(phone) || "—"}\n\n` +
      `🎫 Tier: <b>${esc(tier)}</b>\n` +
      `📅 Date: <b>${esc(date)}</b>\n` +
      `👥 Guests: <b>${esc(guests)}</b>\n` +
      `🍽 Diet: ${esc(diet) || "—"}\n` +
      (rate ? `💳 Rate: ${esc(rate)}\n` : "") +
      (deposit ? `💰 Deposit due: ${esc(deposit)}\n` : "") +
      (balance ? `💵 Balance: ${esc(balance)}\n` : "") +
      (note ? `\n📝 ${esc(note)}` : "");

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    if (!tgRes.ok) {
      const detail = await tgRes.text();
      return res.status(502).json({ ok: false, error: "telegram failed", detail });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
