import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { formatSlot, stepDate } from "../lib/util";

export default function CreatePoll() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [globalTime, setGlobalTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [manualDate, setManualDate] = useState("");
  const [recurStart, setRecurStart] = useState("");
  const [recurFreq, setRecurFreq] = useState("weekly");
  const [recurCount, setRecurCount] = useState(4);
  const [managePasscode, setManagePasscode] = useState("");
  const [createPasscode, setCreatePasscode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const removeSlot = (id) => setSlots((s) => s.filter((x) => x.id !== id));

  const addManualSlot = () => {
    if (!manualDate) return;
    setSlots((s) => [...s, { id: Date.now(), date: manualDate }]);
    setManualDate("");
  };

  const generateRecurring = () => {
    if (!recurStart || recurCount < 1) return;
    const generated = [];
    let cur = recurStart;
    for (let i = 0; i < recurCount; i++) {
      generated.push({ id: `${Date.now()}-${i}`, date: cur });
      cur = stepDate(cur, recurFreq);
    }
    setSlots((s) => [...s, ...generated]);
  };

  const canSave =
    title.trim() && slots.filter((s) => s.date).length >= 1 && managePasscode.trim() && createPasscode.trim();

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const cleanSlots = slots
        .filter((s) => s.date)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s, i) => ({ id: `s${i}`, date: s.date, time: globalTime, label: formatSlot(s.date, globalTime) }));

      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passcode: createPasscode,
          title,
          notes,
          slots: cleanSlots,
          managePasscode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push(`/poll/${data.code}?created=1`);
    } catch (e) {
      setError(e.message || "Couldn't create the poll — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <Head>
        <title>New poll — Overlap</title>
      </Head>
      <Link href="/" className="brand">
        <span className="brand-mark">🔥</span>
        <span className="brand-name">Overlap</span>
      </Link>

      <h2 className="title">New poll</h2>
      <div style={{ height: 20 }} />

      <label className="label">What's this for?</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Team retro, dinner with the Chens..."
        style={{ marginBottom: 16 }}
      />

      <label className="label">Notes (optional)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Location, context, anything worth knowing"
        rows={2}
        style={{ marginBottom: 24 }}
      />

      <label className="label">Time (applies to every date below)</label>
      <input
        type="time"
        value={globalTime}
        onChange={(e) => setGlobalTime(e.target.value)}
        style={{ width: 160, marginBottom: 24 }}
      />

      <label className="label">Proposed dates</label>
      {slots.length > 0 && (
        <div className="stack" style={{ marginBottom: 12 }}>
          {slots.map((slot, i) => (
            <div key={slot.id} className="row" style={{ justifyContent: "space-between", background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 10, padding: "10px 14px" }}>
              <span>{slot.date ? formatSlot(slot.date, globalTime) : `Date ${i + 1}`}</span>
              <button onClick={() => removeSlot(slot.id)} className="btn-ghost" style={{ padding: 0 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ marginBottom: 24 }}>
        <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
        <button onClick={addManualSlot} disabled={!manualDate} className="btn btn-secondary btn-small">
          + Add date
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <p className="label" style={{ marginBottom: 12 }}>
          Or generate a recurring set
        </p>
        <div className="row-wrap">
          <input type="date" value={recurStart} onChange={(e) => setRecurStart(e.target.value)} style={{ width: 150 }} />
          <select value={recurFreq} onChange={(e) => setRecurFreq(e.target.value)} style={{ width: 150 }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
          <span className="muted">×</span>
          <input
            type="number"
            min={1}
            max={20}
            value={recurCount}
            onChange={(e) => setRecurCount(parseInt(e.target.value, 10) || 1)}
            style={{ width: 64 }}
          />
          <button onClick={generateRecurring} disabled={!recurStart} className="btn btn-secondary btn-small">
            + Generate
          </button>
        </div>
        <p className="faint" style={{ marginTop: 8, marginBottom: 0 }}>
          e.g. weekly ×4 from a start date adds four dates, one week apart.
        </p>
      </div>

      <label className="label">Manage passcode</label>
      <p className="faint" style={{ marginTop: 0, marginBottom: 8 }}>
        You'll need this later to edit or close the poll, from any device.
      </p>
      <input
        type="password"
        value={managePasscode}
        onChange={(e) => setManagePasscode(e.target.value)}
        placeholder="Pick something you'll remember"
        style={{ marginBottom: 24 }}
      />

      <label className="label">Poll-creation passcode</label>
      <p className="faint" style={{ marginTop: 0, marginBottom: 8 }}>
        The shared passcode for creating polls with this tool.
      </p>
      <input
        type="password"
        value={createPasscode}
        onChange={(e) => setCreatePasscode(e.target.value)}
        style={{ marginBottom: 24 }}
      />

      {error && <p className="error-text">{error}</p>}

      <div className="row">
        <button onClick={handleCreate} disabled={!canSave || saving} className="btn btn-primary">
          {saving ? "Creating…" : "Create poll"}
        </button>
        <Link href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
