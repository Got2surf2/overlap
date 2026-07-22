export function genCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function slugify(s) {
  return (
    String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "guest"
  );
}

export function formatSlot(dateStr, timeStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  const dateFmt = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (!timeStr) return dateFmt;
  const timeFmt = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateFmt} · ${timeFmt}`;
}

export function stepDate(dateStr, freq) {
  const next = new Date(dateStr + "T00:00:00");
  if (freq === "daily") next.setDate(next.getDate() + 1);
  else if (freq === "weekly") next.setDate(next.getDate() + 7);
  else if (freq === "biweekly") next.setDate(next.getDate() + 14);
  else if (freq === "monthly") next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}

export const STATUS_CYCLE = ["unset", "yes", "maybe", "no"];
export const STATUS_META = {
  unset: { label: "—", className: "chip chip-unset" },
  yes: { label: "Yes", className: "chip chip-yes" },
  maybe: { label: "If need be", className: "chip chip-maybe" },
  no: { label: "No", className: "chip chip-no" },
};
