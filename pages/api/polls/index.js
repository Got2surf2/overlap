import { sql } from "../../../lib/db";
import { genCode } from "../../../lib/util";

function checkCreatePasscode(req) {
  return req.headers["x-create-passcode"] === process.env.CREATE_PASSCODE;
}

export default async function handler(req, res) {
  // Admin dashboard listing — gated by the create passcode (via header).
  if (req.method === "GET") {
    if (!checkCreatePasscode(req)) return res.status(403).json({ error: "Wrong passcode." });
    const rows = await sql`
      select p.code, p.title, p.closed, p.created_at,
        jsonb_array_length(p.slots) as slot_count,
        jsonb_array_length(p.participants) as participant_count,
        (select count(*)::int from responses r where r.poll_code = p.code) as response_count
      from polls p
      order by p.created_at desc
    `;
    return res.status(200).json({ polls: rows });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { passcode, title, notes, slots, participants, managePasscode } = req.body || {};

  // Real server-side check -- this never runs in the browser, so the
  // passcode itself is never shipped to the client.
  if (passcode !== process.env.CREATE_PASSCODE) {
    return res.status(403).json({ error: "Wrong passcode." });
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required." });
  }
  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: "At least one date is required." });
  }
  if (!managePasscode || typeof managePasscode !== "string" || !managePasscode.trim()) {
    return res.status(400).json({ error: "A manage passcode is required." });
  }
  const cleanParticipants = Array.isArray(participants)
    ? participants.map((p) => String(p).trim()).filter(Boolean)
    : [];

  let code = genCode();
  // Extremely unlikely to collide, but guard against it anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await sql`select code from polls where code = ${code}`;
    if (existing.length === 0) break;
    code = genCode();
  }

  try {
    await sql`
      insert into polls (code, title, notes, slots, participants, closed, manage_passcode)
      values (${code}, ${title.trim()}, ${(notes || "").trim()}, ${JSON.stringify(slots)}::jsonb, ${JSON.stringify(cleanParticipants)}::jsonb, false, ${managePasscode.trim()})
    `;
  } catch (e) {
    return res.status(500).json({ error: "Could not create poll." });
  }

  return res.status(200).json({ code });
}
