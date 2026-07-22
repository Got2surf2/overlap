import { useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A month grid where clicking a day toggles it in `selected` (an array of
// "YYYY-MM-DD"). Past days are disabled. Rendered only inside client-side
// forms, so `new Date()` here is safe (no SSR hydration concern).
export default function DateCalendar({ selected = [], onToggle }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedSet = new Set(selected);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          type="button"
          className="cal-nav"
          onClick={() => setView(new Date(year, month - 1, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="cal-title">{view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button
          type="button"
          className="cal-nav"
          onClick={() => setView(new Date(year, month + 1, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-dow">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`empty-${i}`} />;
          const ds = ymd(d);
          return (
            <button
              key={ds}
              type="button"
              disabled={d < today}
              onClick={() => onToggle(ds)}
              className={`cal-day ${selectedSet.has(ds) ? "cal-sel" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
