import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { formatSlot, slugify, STATUS_CYCLE, STATUS_META } from "../../lib/util";

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
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [choices, setChoices] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [respondError, setRespondError] = useState("");

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

  const cycleChoice = (slotId) => {
    setChoices((c) => {
      const cur = c[slotId] || "unset";
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      return { ...c, [slotId]: next };
    });
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

  const addManageSlot = () => {
    if (!newSlotDate) return;
    const newSlot = {
      id: `s${Date.now()}`,
      date: newSlotDate,
      time: newSlotTime,
      label: formatSlot(newSlotDate, newSlotTime),
    };
    saveUpdates({ slots: [...meta.slots, newSlot] });
    setNewSlotDate("");
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
          <span className="brand-mark">🔥</span>
          <span className="brand-name">Overlap</span>
        </Link>
        <p className="error-text">{loadError || "This poll couldn't be loaded."}</p>
        <Link href="/">← Back home</Link>
      </div>
    );
  }

  const tally = meta.slots.map((slot) => {
    const yes = responses.filter((r) => r.choices?.[slot.id] === "yes").length;
    const maybe = responses.filter((r) => r.choices?.[slot.id] === "maybe").length;
    const score = yes + maybe * 0.5;
    return { ...slot, yes, maybe, score };
  });
  const bestScore = Math.max(0, ...tally.map((t) => t.score));

  return (
    <div className="page">
      <Head>
        <title>{meta.title} — Overlap</title>
      </Head>
      <Link href="/" className="brand">
        <span className="brand-mark">🔥</span>
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
                disabled={busy || !editTitle.trim()}
                className="btn btn-secondary btn-small"
              >
                Save
              </button>
            </div>

            <div style={{ borderTop: "1px solid #232B3D", paddingTop: 16 }}>
              <label className="label">Times</label>
              <div className="stack" style={{ marginBottom: 10 }}>
                {meta.slots.map((s) => (
                  <div
                    key={s.id}
                    className="row"
                    style={{ justifyContent: "space-between", background: "#161C29", borderRadius: 8, padding: "8px 12px" }}
                  >
                    <span>{s.label}</span>
                    <button onClick={() => removeManageSlot(s.id)} disabled={busy} className="btn-ghost" style={{ padding: 0 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="row">
                <input type="date" value={newSlotDate} onChange={(e) => setNewSlotDate(e.target.value)} />
                <input type="time" value={newSlotTime} onChange={(e) => setNewSlotTime(e.target.value)} style={{ width: 110 }} />
                <button onClick={addManageSlot} disabled={!newSlotDate || busy} className="btn btn-secondary btn-small">
                  + Add
                </button>
              </div>
            </div>

            <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid #232B3D", paddingTop: 16 }}>
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

            <div style={{ borderTop: "1px solid #232B3D", paddingTop: 16 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="btn-danger">
                  🗑 Delete this poll
                </button>
              ) : (
                <div className="row">
                  <span style={{ color: "#C98A9C", fontSize: 14 }}>Delete permanently?</span>
                  <button onClick={deletePoll} disabled={busy} className="btn btn-small" style={{ background: "#3A2B33", color: "#E8A0B5" }}>
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

      {/* Respond flow */}
      {meta.closed ? (
        <div className="card" style={{ marginBottom: 32 }}>
          <p className="muted" style={{ margin: 0 }}>🔒 This poll is closed to new responses.</p>
        </div>
      ) : !joined ? (
        <div className="card" style={{ marginBottom: 32 }}>
          <label className="label">Add your availability</label>
          <div className="row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startResponding()}
              placeholder="Your name"
            />
            <button onClick={startResponding} disabled={!name.trim()} className="btn btn-primary">
              Next →
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 32 }}>
          <p className="muted" style={{ marginBottom: 16 }}>
            Tap each time to cycle: <span style={{ color: "var(--good)" }}>Yes</span> → If need be → No
          </p>
          <div className="stack" style={{ marginBottom: 16 }}>
            {meta.slots.map((slot) => {
              const st = STATUS_META[choices[slot.id] || "unset"];
              return (
                <button key={slot.id} onClick={() => cycleChoice(slot.id)} className={st.className}>
                  <span>{slot.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{st.label}</span>
                </button>
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
      )}

      {/* Results */}
      <label className="label" style={{ marginBottom: 12 }}>
        Overlap
      </label>
      <div>
        {tally.map((t) => {
          const isBest = bestScore > 0 && t.score === bestScore;
          const pct = responses.length ? Math.round((t.score / responses.length) * 100) : 0;
          return (
            <div key={t.id} className={`bar-row ${isBest ? "best" : ""}`}>
              <div className="bar-fill" style={{ width: `${pct}%` }} />
              <div className="bar-content">
                <span>
                  {isBest && "🔥 "}
                  {t.label}
                </span>
                <span className="mono faint">
                  {t.yes} yes{t.maybe ? ` · ${t.maybe} maybe` : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {responses.length > 0 && (
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #232B3D" }}>
          <label className="label" style={{ marginBottom: 12 }}>
            Who's responded
          </label>
          <div className="row-wrap">
            {responses.map((r) => (
              <span key={r.slug} className="pill">
                {r.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
