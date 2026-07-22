import { sql, parseJson } from "../../../lib/db";

function checkPasscode(req) {
  return req.headers["x-create-passcode"] === process.env.CREATE_PASSCODE;
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === "PATCH") {
    if (!checkPasscode(req)) return res.status(403).json({ error: "Wrong passcode." });
    const { name, members } = req.body || {};

    if (name !== undefined) {
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Group name can't be empty." });
      }
      await sql`update groups set name = ${name.trim()} where id = ${id}`;
    }
    if (members !== undefined) {
      const cleanMembers = Array.isArray(members) ? members.map((m) => String(m).trim()).filter(Boolean) : [];
      await sql`update groups set members = ${JSON.stringify(cleanMembers)}::jsonb where id = ${id}`;
    }

    const rows = await sql`select id, name, members, created_at from groups where id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Group not found." });
    const group = { ...rows[0], members: parseJson(rows[0].members) || [] };
    return res.status(200).json({ group });
  }

  if (req.method === "DELETE") {
    if (!checkPasscode(req)) return res.status(403).json({ error: "Wrong passcode." });
    await sql`delete from groups where id = ${id}`;
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
