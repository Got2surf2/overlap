import { sql } from "../../../../lib/db";
import { slugify } from "../../../../lib/util";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.query;
  const { name, choices } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!choices || typeof choices !== "object") {
    return res.status(400).json({ error: "Choices are required." });
  }

  const pollRows = await sql`select closed from polls where code = ${code}`;
  if (pollRows.length === 0) return res.status(404).json({ error: "Poll not found." });
  if (pollRows[0].closed) return res.status(403).json({ error: "This poll is closed to new responses." });

  const slug = slugify(name);

  try {
    await sql`
      insert into responses (poll_code, name, slug, choices, submitted_at)
      values (${code}, ${name.trim()}, ${slug}, ${JSON.stringify(choices)}::jsonb, now())
      on conflict (poll_code, slug)
      do update set name = excluded.name, choices = excluded.choices, submitted_at = excluded.submitted_at
    `;
  } catch (e) {
    return res.status(500).json({ error: "Could not save your response." });
  }

  return res.status(200).json({ ok: true });
}
