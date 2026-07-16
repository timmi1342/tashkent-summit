// Vercel Serverless Function — отдаёт реальные ближайшие выезды
// (дата, трек, сколько мест ещё свободно) из Supabase.
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method not allowed" });

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ ok: false, error: "server not configured" });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("departures")
      .select("date, track, capacity, booked_guests")
      .eq("status", "open")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(200);

    if (error) return res.status(500).json({ ok: false, error: "db error", detail: error.message });

    const departures = (data || []).map((d) => ({
      date: d.date,
      track: d.track,
      available: Math.max(0, d.capacity - d.booked_guests),
    }));

    // кэшируем на минуту на CDN — расписание меняется не поминутно
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ ok: true, departures });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
