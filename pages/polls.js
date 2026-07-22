import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import CalendarMark from "../components/CalendarMark";

async function api(path, passcode, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-create-passcode": passcode,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function Polls() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);

  const [polls, setPolls] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [copied, setCopied] = useState("");

  const unlock = async () => {
    setChecking(true);
    setAuthError("");
    try {
      const data = await api("/api/polls", passcode);
      setPolls(data.polls);
      setUnlocked(true);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const refresh = async () => {
    try {
      const data = await api("/api/polls", passcode);
      setPolls(data.polls);
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleClosed = async (code, closed) => {
    setBusy(code);
    setError("");
    try {
      await api(`/api/polls/${code}`, passcode, { method: "PATCH", body: JSON.stringify({ updates: { closed: !closed } }) });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const deletePoll = async (code) => {
    setBusy(code);
    setError("");
    try {
      await api(`/api/polls/${code}`, passcode, { method: "DELETE", body: JSON.stringify({}) });
      setConfirmId("");
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const copyLink = (code) => {
    if (navigator.clipboard) navigator.clipboard.writeText(`${window.location.origin}/poll/${code}`).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(""), 1600);
  };

  return (
    <div className="page">
      <Head>
        <title>Polls — Overlap</title>
      </Head>
      <Link href="/" className="brand">
        <span className="brand-mark">
          <CalendarMark />
        </span>
        <span className="brand-name">Overlap</span>
      </Link>

      <h2 className="title">Your polls</h2>
      <p className="subtitle">Every poll in one place — open, share, close, or delete.</p>

      {!unlocked ? (
        <div className="card" style={{ maxWidth: 380 }}>
          <label className="label">Passcode</label>
          <div className="row">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              autoFocus
            />
            <button onClick={unlock} disabled={checking || !passcode.trim()} className="btn btn-primary">
              Unlock
            </button>
          </div>
          {authError && <p className="error-text">{authError}</p>}
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 20 }}>
            <Link href="/create" className="btn btn-primary" style={{ textDecoration: "none" }}>
              + New poll
            </Link>
            <Link href="/groups" className="btn btn-secondary" style={{ textDecoration: "none" }}>
              Groups
            </Link>
          </div>

          {error && <p className="error-text">{error}</p>}

          {polls.length === 0 ? (
            <p className="muted">No polls yet — create one above.</p>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {polls.map((p) => (
                <div key={p.code} className="card">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <Link
                        href={`/poll/${p.code}`}
                        style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", textDecoration: "none" }}
                      >
                        {p.title}
                      </Link>
                      <div className="row-wrap" style={{ gap: 8, marginTop: 6 }}>
                        <span className="mono faint">{p.code}</span>
                        {p.closed && <span className="badge badge-closed">🔒 Closed</span>}
                      </div>
                    </div>
                    <button onClick={() => copyLink(p.code)} className="btn btn-secondary btn-small" style={{ flexShrink: 0 }}>
                      {copied === p.code ? "Copied" : "Copy link"}
                    </button>
                  </div>

                  <p className="faint" style={{ margin: "10px 0 12px" }}>
                    {p.response_count} {p.response_count === 1 ? "response" : "responses"} · {p.slot_count} date
                    {p.slot_count === 1 ? "" : "s"}
                    {p.participant_count ? ` · ${p.participant_count} invited` : ""}
                  </p>

                  <div className="row">
                    <Link href={`/poll/${p.code}`} className="btn btn-secondary btn-small" style={{ textDecoration: "none" }}>
                      Open
                    </Link>
                    <button onClick={() => toggleClosed(p.code, p.closed)} disabled={busy === p.code} className="btn btn-secondary btn-small">
                      {p.closed ? "Reopen" : "Close"}
                    </button>
                    {confirmId === p.code ? (
                      <div className="row" style={{ marginLeft: "auto" }}>
                        <span style={{ color: "var(--danger)", fontSize: 13 }}>Delete?</span>
                        <button
                          onClick={() => deletePoll(p.code)}
                          disabled={busy === p.code}
                          className="btn btn-small"
                          style={{ background: "var(--danger-bg)", color: "var(--danger-strong)" }}
                        >
                          Yes, delete
                        </button>
                        <button onClick={() => setConfirmId("")} className="btn-ghost btn-small">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(p.code)} className="btn-danger btn-small" style={{ marginLeft: "auto" }}>
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
