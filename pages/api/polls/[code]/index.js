import { sql, parseJson } from "../../../../lib/db";

const ALLOWED_UPDATE_FIELDS = ["title", "notes", "slots", "closed"];

export default async function handler(req, res) {
  const { code } = req.query;

  if (req.method === "GET") {
    const pollRows = await sql`select * from polls where code = ${code}`;
    if (pollRows.length === 0) return res.status(404).json({ error: "Poll not found." });

    const responseRows = await sql`
      select name, slug, choices, submitted_at from responses
      where poll_code = ${code} order by submitted_at asc
    `;

    const { manage_passcode, ...safePoll } = pollRows[0];
    safePoll.slots = parseJson(safePoll.slots);
    const responses = responseRows.map((r) => ({ ...r, choices: parseJson(r.choices) }));

    return res.status(200).json({ poll: safePoll, responses });
  }

  if (req.method === "PATCH") {
    const { passcode, updates } = req.body || {};
    const pollRows = await sql`select manage_passcode from polls where code = ${code}`;
    if (pollRows.length === 0) return res.status(404).json({ error: "Poll not found." });
    if (passcode !== pollRows[0].manage_passcode) return res.status(403).json({ error: "Wrong manage passcode." });

    const cleanUpdates = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (updates && Object.prototype.hasOwnProperty.call(updates, key)) cleanUpdates[key] = updates[key];
    }
    if (Object.keys(cleanUpdates).length === 0) return res.status(400).json({ error: "Nothing to update." });

    try {
      if ("title" in cleanUpdates) {
        await sql`update polls set title = ${cleanUpdates.title} where code = ${code}`;
      }
      if ("notes" in cleanUpdates) {
        await sql`update polls set notes = ${cleanUpdates.notes} where code = ${code}`;
      }
      if ("slots" in cleanUpdates) {
        await sql`update polls set slots = ${JSON.stringify(cleanUpdates.slots)}::jsonb where code = ${code}`;
      }
      if ("closed" in cleanUpdates) {
        await sql`update polls set closed = ${cleanUpdates.closed} where code = ${code}`;
      }
    } catch (e) {
      return res.status(500).json({ error: "Could not save changes." });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { passcode } = req.body || {};
    const pollRows = await sql`select manage_passcode from polls where code = ${code}`;
    if (pollRows.length === 0) return res.status(404).json({ error: "Poll not found." });
    if (passcode !== pollRows[0].manage_passcode) return res.status(403).json({ error: "Wrong manage passcode." });

    await sql`delete from responses where poll_code = ${code}`;
    await sql`delete from polls where code = ${code}`;
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
