import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { formatSlot, stepDate } from "../lib/util";
import DateCalendar from "../components/DateCalendar";
import CalendarMark from "../components/CalendarMark";

export default function CreatePoll() {
  const router = useRouter();

  // Passcode gate -- entering this successfully both unlocks the form and
  // lets us fetch saved groups, since group data is passcode-protected too.
  const [createPasscode, setCreatePasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);
  const [groups, setGroups] = useState([]);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [globalTime, setGlobalTime] = useState("");
  const [slots, setSlots] = useState([]);
  const [recurStart, setRecurStart] = useState("");
  const [recurFreq, setRecurFreq] = useState("weekly");
  const [recurCount, setRecurCount] = useState(4);
  const [managePasscode, setManagePasscode] = useState("");
  const [participants, setParticipants] = useState([]);
  const [participantInput, setParticipantInput] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unlock = async () => {
    setChecking(true);
    setAuthError("");
    try {
      const res = await fetch("/api/groups", { headers: { "x-create-passcode": createPasscode } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Wrong passcode.");
      setGroups(data.groups);
      setUnlocked(true);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const loadGroup = (groupId) => {
    setSelectedGroupId(groupId);
    if (!groupId) return;
    const group = groups.find((g) => String(g.id) === groupId);
    if (group) setParticipants(group.members);
  };

  const addParticipant = () => {
    const name = participantInput.trim();
    if (!name || participants.includes(name)) return;
    setParticipants((p) => [...p, name]);
    setParticipantInput("");
  };
  const removeParticipant = (name) => setParticipants((p) => p.filter((n) => n !== name));

  const removeSlot = (id) => setSlots((s) => s.filter((x) => x.id !== id));

  // Click a calendar day to add it; click it again to remove it.
  const toggleDate = (ds) => {
    setSlots((s) => (s.some((x) => x.date === ds) ? s.filter((x) => x.date !== ds) : [...s, { id: ds, date: ds }]));
  };

  const generateRecurring = () => {
    if (!recurStart || recurCount < 1) return;
    const generated = [];
    let cur = recurStart;
    for (let i = 0; i < recurCount; i++) {
      generated.push({ id: cur, date: cur });
      cur = stepDate(cur, recurFreq);
    }
    // Skip dates already picked so nothing is added twice.
    setSlots((s) => {
      const have = new Set(s.map((x) => x.date));
      return [...s, ...generated.filter((g) => !have.has(g.date))];
    });
  };

  const canSave = title.trim() && slots.filter((s) => s.date).length >= 1 && managePasscode.trim();

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const cleanSlots = slots
        .filter((s) => s.date)
        .filter((s, i, arr) => arr.findIndex((x) => x.date === s.date) === i)
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
          participants,
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

  if (!unlocked) {
    return (
      <div className="page">
        <Head>
          <title>New poll — Overlap</title>
        </Head>
        <Link href="/" className="brand">
          <span className="brand-mark"><CalendarMark /></span>
          <span className="brand-name">Overlap</span>
        </Link>
        <h2 className="title">New poll</h2>
        <div style={{ height: 20 }} />
        <div className="card" style={{ maxWidth: 380 }}>
          <label className="label">Passcode</label>
          <div className="row">
            <input
              type="password"
              value={createPasscode}
              onChange={(e) => setCreatePasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              autoFocus
            />
            <button onClick={unlock} disabled={checking || !createPasscode.trim()} className="btn btn-primary">
              Unlock
            </button>
          </div>
          {authError && <p className="error-text">{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Head>
        <title>New poll — Overlap</title>
      </Head>
      <Link href="/" className="brand">
        <span className="brand-mark"><CalendarMark /></span>
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

      <div style={{ marginBottom: 24 }}>
        <DateCalendar selected={slots.map((s) => s.date)} onToggle={toggleDate} />
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

      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
        <label className="label" style={{ marginBottom: 0 }}>
          Who's invited? (optional)
        </label>
        <Link href="/groups" className="faint" style={{ textDecoration: "underline" }}>
          Manage groups →
        </Link>
      </div>
      <p className="faint" style={{ marginTop: 0, marginBottom: 8 }}>
        Add names here and responders pick from a dropdown instead of typing. Leave this empty to let anyone type any name.
      </p>

      {groups.length > 0 && (
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={selectedGroupId} onChange={(e) => loadGroup(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">Load from a group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.members.length})
              </option>
            ))}
          </select>
        </div>
      )}

      {participants.length > 0 && (
        <div className="row-wrap" style={{ marginBottom: 10 }}>
          {participants.map((p) => (
            <span key={p} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {p}
              <button
                onClick={() => removeParticipant(p)}
                className="btn-ghost"
                style={{ padding: 0, fontSize: 12, lineHeight: 1 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ marginBottom: 24 }}>
        <input
          type="text"
          value={participantInput}
          onChange={(e) => setParticipantInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addParticipant())}
          placeholder="Add a name"
        />
        <button onClick={addParticipant} disabled={!participantInput.trim()} className="btn btn-secondary btn-small">
          + Add
        </button>
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
