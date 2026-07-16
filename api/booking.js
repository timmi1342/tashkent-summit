// Vercel Serverless Function — принимает бронь, атомарно резервирует
// место в Supabase (с реальной проверкой вместимости) и уведомляет Telegram.
import { createClient } from "@supabase/supabase-js";

const PRICES = { explorer: 220, standard: 290, athlete: 390 };
const RES_DISC = 0.35;
const DEPOSIT = 0.30;
const EBIKE = 30;

const rprice = (base) => Math.round((base * (1 - RES_DISC)) / 5) * 5;
const priceFor = (tier, rate) => (rate === "resident" ? rprice(PRICES[tier]) : PRICES[tier]);
const trackFor = (tier) => (tier === "athlete" ? "athlete" : "mixed");
const makeRef = () => "TSC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
const money = (v) => "$" + Number(v).toLocaleString("en-US");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method not allowed" });

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const clip = (v, n) => (v == null ? "" : String(v)).slice(0, n);

    const tier = clip(b.tier, 20).toLowerCase();
    const date = clip(b.date, 10); // YYYY-MM-DD
    const guests = parseInt(b.guests, 10);
    const ebike = !!b.ebike && tier !== "athlete";
    const rate = clip(b.rate, 20) === "resident" ? "resident" : "visitor";
    const name = clip(b.name, 120);
    const email = clip(b.email, 120);
    const phone = clip(b.phone, 60);
    const diet = clip(b.diet, 60);
    const note = clip(b.note, 500);
    const clientRef = clip(b.ref, 20);

    // ---- Валидация входных данных ----
    if (!["explorer", "standard", "athlete"].includes(tier)) {
      return res.status(400).json({ ok: false, error: "invalid tier" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: "invalid date" });
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > 12) {
      return res.status(400).json({ ok: false, error: "invalid guests" });
    }
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "missing fields" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ ok: false, error: "server not configured" });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ---- Найти выезд по дате + треку (mixed = explorer+standard, athlete отдельно) ----
    const track = trackFor(tier);
    const { data: departure, error: depErr } = await supabase
      .from("departures")
      .select("id")
      .eq("date", date)
      .eq("track", track)
      .maybeSingle();

    if (depErr) return res.status(500).json({ ok: false, error: "db error", detail: depErr.message });
    if (!departure) return res.status(400).json({ ok: false, error: "departure not found" });

    // ---- Сервер сам считает деньги — клиенту не доверяем ----
    const unit = priceFor(tier, rate);
    const rideCost = ebike ? EBIKE * guests : 0;
    const total = unit * guests + rideCost;
    const deposit = Math.round(total * DEPOSIT);
    const balance = total - deposit;
    // используем ref от клиента, если он похож на настоящий (чтобы совпадал с экраном подтверждения),
    // иначе генерируем сами
    const ref = /^TSC-[A-Z0-9]{6}$/.test(clientRef) ? clientRef : makeRef();

    // ---- Атомарная бронь: блокирует выезд, проверяет вместимость, пишет бронь ----
    const { error: bookErr } = await supabase.rpc("book_departure", {
      p_departure_id: departure.id,
      p_ref: ref,
      p_tier: tier,
      p_guests: guests,
      p_ebike: ebike,
      p_rate: rate,
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_diet: diet,
      p_note: note,
      p_amount_total: total,
      p_amount_deposit: deposit,
      p_amount_balance: balance,
    });

    if (bookErr) {
      const msg = bookErr.message || "";
      if (msg.includes("NOT_ENOUGH_CAPACITY")) {
        return res.status(409).json({ ok: false, error: "not_enough_capacity" });
      }
      if (msg.includes("DEPARTURE_CLOSED") || msg.includes("DEPARTURE_NOT_FOUND")) {
        return res.status(409).json({ ok: false, error: "departure_unavailable" });
      }
      // дубликат ref (крайне маловероятно) — просто просим повторить
      if (msg.includes("duplicate key")) {
        return res.status(409).json({ ok: false, error: "duplicate_ref" });
      }
      return res.status(500).json({ ok: false, error: "booking_failed", detail: msg });
    }

    // ---- Уведомление в Telegram (как раньше), уже после успешной записи в БД ----
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const text =
        `🏔 <b>New booking — Tashkent Summit</b>\n` +
        `Ref: <code>${esc(ref)}</code>\n\n` +
        `👤 <b>${esc(name)}</b>\n` +
        `✉️ ${esc(email)}\n` +
        `📱 ${esc(phone) || "—"}\n\n` +
        `🎫 Tier: <b>${esc(tier)}</b>${ebike ? " (+e-bike)" : ""}\n` +
        `📅 Date: <b>${esc(date)}</b>\n` +
        `👥 Guests: <b>${guests}</b>\n` +
        `🍽 Diet: ${esc(diet) || "—"}\n` +
        `💳 Rate: ${esc(rate)}\n` +
        `💰 Deposit due: ${money(deposit)}\n` +
        `💵 Balance: ${money(balance)}\n` +
        (note ? `\n📝 ${esc(note)}` : "");

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        });
        if (!tgRes.ok) console.error("telegram notify failed", await tgRes.text());
      } catch (e) {
        console.error("telegram notify error", e);
        // бронь уже сохранена в БД — не роняем запрос из-за Telegram
      }
    }

    return res.status(200).json({ ok: true, ref, deposit, balance, total });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
