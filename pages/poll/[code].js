import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { formatSlot, slugify, stepDate } from "../../lib/util";
import DateCalendar from "../../components/DateCalendar";
import CalendarMark from "../../components/CalendarMark";

const STATE_META = {
  solid: { cls: "avail-solid", word: "Available" },
  soft: { cls: "avail-soft", word: "If need be" },
  incomplete: { cls: "avail-incomplete", word: "Incomplete" },
  unavailable: { cls: "avail-unavailable", word: "Unavailable" },
};

export default function PollPage() {
  const router = useRouter();
  const { code, created } = router.query;

  const [meta, setMeta] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const [manageOpen, setManageOpen] = useState(false);
  const [manageUnlocked, setManageUnlocked] = useState(false);
  const [managePasscodeInput, setManagePasscodeInput] = useState("");
  const [manageAuthError, setManageAuthError] = useState("");
  const [manageError, setManageError] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editParticipants, setEditParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  // Adding dates from the manage panel — a multi-select set plus the recurring picker.
  const [newDates, setNewDates] = useState([]);
  const [mRecurStart, setMRecurStart] = useState("");
  const [mRecurFreq, setMRecurFreq] = useState("weekly");
  const [mRecurCount, setMRecurCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [useOtherName, setUseOtherName] = useState(false);
  const [joined, setJoined] = useState(false);
  const [choices, setChoices] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [respondError, setRespondError] = useState("");

  // Viewer-local availability threshold — not persisted. null = use default.
  const [threshold, setThreshold] = useState(null);
  const [tab, setTab] = useState("best"); // "best" | "mine" | "full"

  const loadPoll = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/polls/${code}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Poll not found.");
      setMeta(data.poll);
      setResponses(data.responses || []);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Couldn't find a poll with that code.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  const copyLink = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(window.location.href.split("?")[0]).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  };

  const startResponding = () => {
    if (!name.trim()) return;
    const init = {};
    meta.slots.forEach((s) => (init[s.id] = "unset"));
    const existing = responses.find((r) => r.slug === slugify(name));
    setChoices(existing ? existing.choices : init);
    setJoined(true);
  };

  // Click a pill to set it; click the selected pill again to clear it.
  const setChoice = (slotId, value) => {
    setChoices((c) => ({ ...c, [slotId]: c[slotId] === value ? "unset" : value }));
  };

  const submitResponse = async () => {
    setSubmitting(true);
    setRespondError("");
    try {
      const res = await fetch(`/api/polls/${code}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, choices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save your response.");
      await loadPoll();
      setJoined(false);
      setName("");
    } catch (e) {
      setRespondError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const checkManagePasscode = async () => {
    // We don't have a lightweight "verify only" endpoint, so we verify by
    // attempting a no-op update (closed stays the same). If it's rejected
    // with 403, the passcode was wrong.
    setManageAuthError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/polls/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: managePasscodeInput, updates: { closed: meta.closed } }),
      });
      if (res.status === 403) {
        setManageAuthError("That's not the right passcode for this poll.");
        return;
      }
      if (!res.ok) throw new Error("Something went wrong.");
      setManageUnlocked(true);
      setEditTitle(meta.title);
      setEditNotes(meta.notes || "");
      setEditParticipants(meta.participants || []);
    } catch (e) {
      setManageAuthError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveUpdates = async (updates) => {
    setBusy(true);
    setManageError("");
    try {
      const res = await fetch(`/api/polls/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: managePasscodeInput, updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save changes.");
      await loadPoll();
    } catch (e) {
      setManageError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = () => {
    if (!editTitle.trim()) return;
    saveUpdates({ title: editTitle.trim(), notes: editNotes.trim() });
  };

  const addEditParticipant = () => {
    const nm = newParticipant.trim();
    if (!nm || editParticipants.includes(nm)) return;
    const updated = [...editParticipants, nm];
    setEditParticipants(updated);
    setNewParticipant("");
    saveUpdates({ participants: updated });
  };

  const removeEditParticipant = (nm) => {
    const updated = editParticipants.filter((n) => n !== nm);
    setEditParticipants(updated);
    saveUpdates({ participants: updated });
  };

  const toggleNewDate = (ds) => {
    setNewDates((n) => (n.includes(ds) ? n.filter((x) => x !== ds) : [...n, ds]));
  };

  const genManageRecurring = () => {
    if (!mRecurStart || mRecurCount < 1) return;
    const gen = [];
    let cur = mRecurStart;
    for (let i = 0; i < mRecurCount; i++) {
      gen.push(cur);
      cur = stepDate(cur, mRecurFreq);
    }
    setNewDates((n) => Array.from(new Set([...n, ...gen])));
  };

  // Append the picked dates (skipping any the poll already has) as new slots.
  const addNewDates = () => {
    const existing = new Set(meta.slots.map((s) => s.date));
    const built = newDates
      .filter((d) => !existing.has(d))
      .sort((a, b) => a.localeCompare(b))
      .map((d, i) => ({ id: `s${Date.now()}-${i}`, date: d, time: newSlotTime, label: formatSlot(d, newSlotTime) }));
    if (built.length === 0) {
      setNewDates([]);
      return;
    }
    saveUpdates({ slots: [...meta.slots, ...built] });
    setNewDates([]);
    setNewSlotTime("");
  };

  const removeManageSlot = (slotId) => {
    saveUpdates({ slots: meta.slots.filter((s) => s.id !== slotId) });
  };

  const toggleClosed = () => {
    saveUpdates({ closed: !meta.closed });
  };

  const deletePoll = async () => {
    setBusy(true);
    setManageError("");
    try {
      const res = await fetch(`/api/polls/${code}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: managePasscodeInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete the poll.");
      router.push("/");
    } catch (e) {
      setManageError(e.message);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading poll…</p>
      </div>
    );
  }

  if (loadError || !meta) {
    return (
      <div className="page">
        <Link href="/" className="brand">
          <span className="brand-mark"><CalendarMark /></span>
          <span className="brand-name">Overlap</span>
        </Link>
        <p className="error-text">{loadError || "This poll couldn't be loaded."}</p>
        <Link href="/">← Back home</Link>
      </div>
    );
  }

  // "Expected" is the invite list if set, otherwise however many have replied.
  const hasList = meta.participants && meta.participants.length > 0;
  const expected = hasList ? meta.participants.length : responses.length;
  const sliderMax = Math.max(1, expected);
  // Default: everyone. Viewers can drag it lower; the value is never saved.
  const effThreshold = Math.min(threshold == null ? sliderMax : threshold, sliderMax);

  // Hide dates that have already passed — only today and later stay visible to
  // responders and in results. (The Manage panel still lists them all so the
  // creator can prune old ones.) Slot dates are "YYYY-MM-DD", so a plain string
  // compare against today (local) is chronological.
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const upcomingSlots = meta.slots.filter((s) => s.date >= todayStr);
  const hasUpcoming = upcomingSlots.length > 0;

  const tally = upcomingSlots.map((slot) => {
    const yes = responses.filter((r) => r.choices?.[slot.id] === "yes").length;
    const maybe = responses.filter((r) => r.choices?.[slot.id] === "maybe").length;
    const no = responses.filter((r) => r.choices?.[slot.id] === "no").length;
    const missing = Math.max(0, expected - (yes + maybe + no));
    let state;
    if (yes >= effThreshold) state = "solid";
    else if (yes + maybe >= effThreshold) state = "soft";
    else if (missing > 0) state = "incomplete";
    else state = "unavailable";
    return { ...slot, yes, maybe, no, missing, state };
  });

  const respondedSlugs = new Set(responses.map((r) => r.slug));
  const pending = hasList ? meta.participants.filter((p) => !respondedSlugs.has(slugify(p))) : [];

  // Whether the title/notes editor has unsaved edits (drives the Save button state).
  const detailsDirty =
    manageUnlocked && (editTitle.trim() !== meta.title || editNotes.trim() !== (meta.notes || ""));

  // Dates that clear the current threshold, best first (firm-yes wins, then more yeses).
  const bestDates = tally
    .filter((t) => t.state === "solid" || t.state === "soft")
    .sort((a, b) => (a.state === b.state ? b.yes - a.yes : a.state === "solid" ? -1 : 1));

  return (
    <div className="page">
      <Head>
        <title>{meta.title} — Overlap</title>
      </Head>
      <Link href="/" className="brand">
        <span className="brand-mark"><CalendarMark /></span>
        <span className="brand-name">Overlap</span>
      </Link>

      {created === "1" && (
        <div className="card" style={{ marginBottom: 24, borderColor: "rgba(232,163,61,0.4)" }}>
          <span className="badge badge-good" style={{ marginBottom: 10 }}>
            ✓ Poll created
          </span>
          <p className="muted" style={{ marginBottom: 12 }}>
            This page's URL is the link — paste it anywhere. Anyone who clicks it lands right here, no code needed.
          </p>
          <button onClick={copyLink} className="btn btn-primary">
            {linkCopied ? "Copied" : "Copy this link"}
          </button>
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <h2 className="title">{meta.title}</h2>
        <button onClick={copyLink} className="btn btn-secondary btn-small" style={{ flexShrink: 0 }}>
          {linkCopied ? "Copied" : "Copy link"}
        </button>
      </div>
      {meta.notes && <p className="muted" style={{ marginBottom: 12 }}>{meta.notes}</p>}
      <div className="row-wrap" style={{ marginBottom: 32 }}>
        <span className="faint">
          {responses.length} {responses.length === 1 ? "response" : "responses"}
        </span>
        {meta.closed && <span className="badge badge-closed">🔒 Closed</span>}
      </div>

      {/* Manage panel */}
      <div style={{ marginBottom: 32 }}>
        <button onClick={() => setManageOpen((o) => !o)} className="btn-ghost" style={{ padding: 0, marginBottom: 12 }}>
          ⚙ {manageOpen ? "Hide" : "Manage poll"}
        </button>

        {manageOpen && !manageUnlocked && (
          <div className="card">
            <label className="label">Manage passcode</label>
            <div className="row">
              <input
                type="password"
                value={managePasscodeInput}
                onChange={(e) => setManagePasscodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkManagePasscode()}
                autoFocus
              />
              <button onClick={checkManagePasscode} disabled={busy} className="btn btn-primary">
                Unlock
              </button>
            </div>
            {manageAuthError && <p className="error-text">{manageAuthError}</p>}
          </div>
        )}

        {manageOpen && manageUnlocked && (
          <div className="card stack" style={{ gap: 20 }}>
            <div>
              <label className="label">Title & notes</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Notes (optional)"
                style={{ marginBottom: 8 }}
              />
              <button
                onClick={saveDetails}
                disabled={busy || !editTitle.trim() || !detailsDirty}
                className={`btn btn-small ${detailsDirty ? "btn-primary" : "btn-secondary"}`}
              >
                {detailsDirty ? "Save changes" : "Saved"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid var(--surface-2)", paddingTop: 16 }}>
              <label className="label">Who's invited</label>
              <p className="faint" style={{ marginTop: 0, marginBottom: 10 }}>
                {editParticipants.length > 0
                  ? "Responders pick from this list."
                  : "No list set — anyone can type any name."}
              </p>
              {editParticipants.length > 0 && (
                <div className="row-wrap" style={{ marginBottom: 10 }}>
                  {editParticipants.map((p) => (
                    <span key={p} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {p}
                      <button
                        onClick={() => removeEditParticipant(p)}
                        disabled={busy}
                        className="btn-ghost"
                        style={{ padding: 0, fontSize: 12, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="row">
                <input
                  type="text"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEditParticipant())}
                  placeholder="Add a name"
                />
                <button onClick={addEditParticipant} disabled={!newParticipant.trim() || busy} className="btn btn-secondary btn-small">
                  + Add
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--surface-2)", paddingTop: 16 }}>
              <label className="label">Times</label>
              <div className="stack" style={{ marginBottom: 10 }}>
                {meta.slots.map((s) => (
                  <div
                    key={s.id}
                    className="row"
                    style={{ justifyContent: "space-between", background: "var(--surface-2)", borderRadius: 8, padding: "8px 12px" }}
                  >
                    <span>{s.label}</span>
                    <button onClick={() => removeManageSlot(s.id)} disabled={busy} className="btn-ghost" style={{ padding: 0 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p className="faint" style={{ marginTop: 0, marginBottom: 8 }}>
                Add more dates — click days below, or generate a recurring set.
              </p>
              <DateCalendar selected={newDates} onToggle={toggleNewDate} />
              <div className="row-wrap" style={{ marginTop: 10 }}>
                <input type="date" value={mRecurStart} onChange={(e) => setMRecurStart(e.target.value)} style={{ width: 150 }} />
                <select value={mRecurFreq} onChange={(e) => setMRecurFreq(e.target.value)} style={{ width: 140 }}>
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
                  value={mRecurCount}
                  onChange={(e) => setMRecurCount(parseInt(e.target.value, 10) || 1)}
                  style={{ width: 64 }}
                />
                <button onClick={genManageRecurring} disabled={!mRecurStart} className="btn btn-secondary btn-small">
                  + Generate
                </button>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <input type="time" value={newSlotTime} onChange={(e) => setNewSlotTime(e.target.value)} style={{ width: 110 }} />
                <button onClick={addNewDates} disabled={newDates.length === 0 || busy} className="btn btn-primary btn-small">
                  Add {newDates.length > 0 ? newDates.length : ""} date{newDates.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>

            <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--surface-2)", paddingTop: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14 }}>{meta.closed ? "Closed to responses" : "Open for responses"}</p>
                <p className="faint" style={{ margin: 0 }}>
                  {meta.closed ? "No one can add or change availability." : "Anyone with the link can respond."}
                </p>
              </div>
              <button onClick={toggleClosed} disabled={busy} className="btn btn-secondary btn-small">
                {meta.closed ? "Reopen" : "Close"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid var(--surface-2)", paddingTop: 16 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="btn-danger">
                  🗑 Delete this poll
                </button>
              ) : (
                <div className="row">
                  <span style={{ color: "var(--danger)", fontSize: 14 }}>Delete permanently?</span>
                  <button onClick={deletePoll} disabled={busy} className="btn btn-small" style={{ background: "var(--danger-bg)", color: "var(--danger-strong)" }}>
                    Yes, delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="btn-ghost btn-small">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {manageError && <p className="error-text">{manageError}</p>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === "best" ? "active" : ""}`} onClick={() => setTab("best")}>
          Best Dates
        </button>
        <button className={`tab ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>
          My availability
        </button>
        <button className={`tab ${tab === "full" ? "active" : ""}`} onClick={() => setTab("full")}>
          Full view
        </button>
      </div>

      {/* Best Dates — dates that clear the threshold */}
      {tab === "best" &&
        (responses.length === 0 ? (
          <p className="muted">No responses yet — the best dates will appear here as people reply.</p>
        ) : !hasUpcoming ? (
          <p className="muted">All of the proposed dates have already passed.</p>
        ) : (
          <>
            <div className="thresh-row">
              <span>Show dates at least</span>
              <input
                type="range"
                min={1}
                max={sliderMax}
                value={effThreshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              />
              <span className="mono" style={{ color: "var(--text)" }}>
                {effThreshold} of {expected}
              </span>
              <span>can make.</span>
            </div>
            {bestDates.length === 0 ? (
              <p className="muted">
                No date works for {effThreshold} of {expected} people yet — drag the slider down, or wait for more
                responses.
              </p>
            ) : (
              <div>
                {bestDates.map((t, i) => (
                  <div key={t.id} className={`best-card ${STATE_META[t.state].cls}`}>
                    <span>
                      <span className="best-rank">#{i + 1}</span>
                      {t.label}
                    </span>
                    <span className="best-count">
                      {t.yes} of {expected} available{t.maybe ? ` · +${t.maybe} maybe` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ))}

      {/* My availability */}
      {tab === "mine" &&
        (meta.closed ? (
        <div className="card" style={{ marginBottom: 32 }}>
          <p className="muted" style={{ margin: 0 }}>🔒 This poll is closed to new responses.</p>
        </div>
      ) : !hasUpcoming ? (
        <div className="card" style={{ marginBottom: 32 }}>
          <p className="muted" style={{ margin: 0 }}>All of the proposed dates have already passed.</p>
        </div>
      ) : !joined ? (
        <div className="card" style={{ marginBottom: 32 }}>
          <label className="label">Add your availability</label>
          {meta.participants && meta.participants.length > 0 && !useOtherName ? (
            <div className="stack">
              <div className="row">
                <select
                  value={name}
                  onChange={(e) => {
                    if (e.target.value === "__other__") {
                      setUseOtherName(true);
                      setName("");
                    } else {
                      setName(e.target.value);
                    }
                  }}
                >
                  <option value="">Select your name…</option>
                  {meta.participants.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="__other__">Someone else…</option>
                </select>
                <button onClick={startResponding} disabled={!name.trim()} className="btn btn-primary">
                  Next →
                </button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="row">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && startResponding()}
                  placeholder="Your name"
                  autoFocus={useOtherName}
                />
                <button onClick={startResponding} disabled={!name.trim()} className="btn btn-primary">
                  Next →
                </button>
              </div>
              {meta.participants && meta.participants.length > 0 && (
                <button
                  onClick={() => {
                    setUseOtherName(false);
                    setName("");
                  }}
                  className="btn-ghost btn-small"
                  style={{ padding: 0, alignSelf: "flex-start" }}
                >
                  ← Choose from list instead
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 32 }}>
          <p className="muted" style={{ marginBottom: 8 }}>
            Pick your availability for each date.
          </p>
          <div className="stack" style={{ marginBottom: 16, gap: 0 }}>
            {upcomingSlots.map((slot) => {
              const cur = choices[slot.id] || "unset";
              return (
                <div key={slot.id} className="slot-row">
                  <span style={{ fontSize: 14 }}>{slot.label}</span>
                  <div className="seg">
                    {[
                      ["yes", "Yes"],
                      ["maybe", "Maybe"],
                      ["no", "No"],
                    ].map(([val, lbl]) => (
                      <button
                        key={val}
                        onClick={() => setChoice(slot.id, val)}
                        className={`seg-pill ${cur === val ? `sel-${val}` : ""}`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {respondError && <p className="error-text">{respondError}</p>}
          <div className="row">
            <button onClick={submitResponse} disabled={submitting} className="btn btn-primary">
              {submitting ? "Saving…" : "Save my availability"}
            </button>
            <button onClick={() => setJoined(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
        ))}

      {/* Full view — every date, counts, and the availability grid */}
      {tab === "full" &&
        (responses.length === 0 ? (
          <p className="muted">No responses yet — you'll see the overlap here as people reply.</p>
        ) : !hasUpcoming ? (
          <p className="muted">All of the proposed dates have already passed.</p>
        ) : (
          <>
          <div className="thresh-row">
            <span>Highlight dates at least</span>
            <input
              type="range"
              min={1}
              max={sliderMax}
              value={effThreshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            />
            <span className="mono" style={{ color: "var(--text)" }}>
              {effThreshold} of {expected}
            </span>
            <span>can make.</span>
          </div>

          <div className="legend">
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: "var(--avail-solid-bg)", borderColor: "var(--avail-solid-border)" }} />
              Available
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: "var(--avail-soft-bg)", borderColor: "var(--avail-soft-border)" }} />
              With maybes
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: "var(--avail-incomplete-bg)", borderColor: "var(--avail-incomplete-border)" }} />
              Incomplete
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: "var(--avail-unavail-bg)", borderColor: "var(--avail-unavail-border)" }} />
              Unavailable
            </span>
          </div>

          <div style={{ marginBottom: 32 }}>
            {tally.map((t) => (
              <div key={t.id} className={`avail-row ${STATE_META[t.state].cls}`}>
                <span>{t.label}</span>
                <span className="avail-count">
                  {t.yes} yes{t.maybe ? ` · ${t.maybe} maybe` : ""}
                  {t.no ? ` · ${t.no} no` : ""}
                  {t.missing ? ` · ${t.missing} pending` : ""}
                </span>
              </div>
            ))}
          </div>

          <label className="label" style={{ marginBottom: 12 }}>
            Everyone's availability
          </label>
          <div className="grid-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="name">Who</th>
                  {upcomingSlots.map((s) => (
                    <th key={s.id}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.slug}>
                    <td className="name">{r.name}</td>
                    {upcomingSlots.map((s) => {
                      const c = r.choices?.[s.id];
                      const cls =
                        c === "yes" ? "cell-yes" : c === "maybe" ? "cell-maybe" : c === "no" ? "cell-no" : "cell-blank";
                      return (
                        <td key={s.id}>
                          <span className={`cell ${cls}`} title={c || "no answer"} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {pending.map((p) => (
                  <tr key={p}>
                    <td className="name faint">{p}</td>
                    {upcomingSlots.map((s) => (
                      <td key={s.id}>
                        <span className="cell cell-blank" title="hasn't responded" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
        ))}
    </div>
  );
}
