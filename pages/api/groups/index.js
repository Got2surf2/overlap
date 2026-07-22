import { sql, parseJson } from "../../../lib/db";

function checkPasscode(req) {
  return req.headers["x-create-passcode"] === process.env.CREATE_PASSCODE;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!checkPasscode(req)) return res.status(403).json({ error: "Wrong passcode." });
    const rows = await sql`select id, name, members, created_at from groups order by name asc`;
    const groups = rows.map((g) => ({ ...g, members: parseJson(g.members) || [] }));
    return res.status(200).json({ groups });
  }

  if (req.method === "POST") {
    if (!checkPasscode(req)) return res.status(403).json({ error: "Wrong passcode." });
    const { name, members } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }
    const cleanMembers = Array.isArray(members) ? members.map((m) => String(m).trim()).filter(Boolean) : [];

    const rows = await sql`
      insert into groups (name, members)
      values (${name.trim()}, ${JSON.stringify(cleanMembers)}::jsonb)
      returning id, name, members, created_at
    `;
    const group = { ...rows[0], members: parseJson(rows[0].members) || [] };
    return res.status(200).json({ group });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
