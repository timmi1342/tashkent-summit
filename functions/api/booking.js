// Cloudflare Pages Function — receives a booking from the site and sends it to Telegram.
// Secrets are read from the environment (set in Cloudflare dashboard), NOT hardcoded:
//   TELEGRAM_BOT_TOKEN  — the token from @BotFather
//   TELEGRAM_CHAT_ID    — your chat id (from @userinfobot)

export async function onRequestPost({ request, env }) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const b = await request.json();

    const name = (b.name || "").toString().slice(0, 120);
    const email = (b.email || "").toString().slice(0, 120);
    const phone = (b.phone || "").toString().slice(0, 60);
    const tier = (b.tier || "").toString().slice(0, 60);
    const date = (b.date || "").toString().slice(0, 40);
    const guests = (b.guests || "").toString().slice(0, 10);
    const diet = (b.diet || "").toString().slice(0, 60);
    const note = (b.note || "").toString().slice(0, 500);
    const ref = (b.ref || "").toString().slice(0, 40);
    const deposit = (b.deposit || "").toString().slice(0, 40);
    const balance = (b.balance || "").toString().slice(0, 40);
    const rate = (b.rate || "").toString().slice(0, 20);

    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, error: "missing fields" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return new Response(JSON.stringify({ ok: false, error: "server not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ ok: false, error: "telegram failed", detail }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
