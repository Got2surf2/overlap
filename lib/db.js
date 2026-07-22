import { neon } from "@neondatabase/serverless";

// This uses your Neon connection string, which lives only in server-side
// environment variables. Never import this from a component that runs in
// the browser -- everything here executes inside API routes only.
export const sql = neon(process.env.DATABASE_URL);

// jsonb columns sometimes come back as strings depending on the driver's
// type parsing; this normalizes either case.
export function parseJson(value) {
  if (value == null) return value;
  return typeof value === "string" ? JSON.parse(value) : value;
}
