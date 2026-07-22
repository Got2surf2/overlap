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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function Groups() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);

  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newMembers, setNewMembers] = useState([]);
  const [newMemberInput, setNewMemberInput] = useState("");
  const [creating, setCreating] = useState(false);

  const unlock = async () => {
    setChecking(true);
    setAuthError("");
    try {
      const data = await api("/api/groups", passcode);
      setGroups(data.groups);
      setUnlocked(true);
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const refresh = async () => {
    try {
      const data = await api("/api/groups", passcode);
      setGroups(data.groups);
    } catch (e) {
      setError(e.message);
    }
  };

  const addNewMember = () => {
    const nm = newMemberInput.trim();
    if (!nm || newMembers.includes(nm)) return;
    setNewMembers((m) => [...m, nm]);
    setNewMemberInput("");
  };

  const createGroup = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await api("/api/groups", passcode, {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), members: newMembers }),
      });
      setNewName("");
      setNewMembers([]);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const renameGroup = async (id, name) => {
    try {
      await api(`/api/groups/${id}`, passcode, { method: "PATCH", body: JSON.stringify({ name }) });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const updateMembers = async (id, members) => {
    try {
      await api(`/api/groups/${id}`, passcode, { method: "PATCH", body: JSON.stringify({ members }) });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const deleteGroup = async (id) => {
    try {
      await api(`/api/groups/${id}`, passcode, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <Head>
        <title>Groups — Overlap</title>
      </Head>
      <Link href="/" className="brand">
        <span className="brand-mark"><CalendarMark /></span>
        <span className="brand-name">Overlap</span>
      </Link>

      <h2 className="title">Groups</h2>
      <p className="subtitle">Save name lists once — like "Family" or "Poker night" — and load them into any poll.</p>

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
          {error && <p className="error-text">{error}</p>}

          <div className="card" style={{ marginBottom: 24 }}>
            <label className="label">New group</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Family, Poker group"
              style={{ marginBottom: 10 }}
            />
            {newMembers.length > 0 && (
              <div className="row-wrap" style={{ marginBottom: 10 }}>
                {newMembers.map((m) => (
                  <span key={m} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {m}
                    <button
                      onClick={() => setNewMembers((list) => list.filter((n) => n !== m))}
                      className="btn-ghost"
                      style={{ padding: 0, fontSize: 12, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="row" style={{ marginBottom: 12 }}>
              <input
                type="text"
                value={newMemberInput}
                onChange={(e) => setNewMemberInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNewMember())}
                placeholder="Add a name"
              />
              <button onClick={addNewMember} disabled={!newMemberInput.trim()} className="btn btn-secondary btn-small">
                + Add
              </button>
            </div>
            <button onClick={createGroup} disabled={creating || !newName.trim()} className="btn btn-primary">
              {creating ? "Creating…" : "Create group"}
            </button>
          </div>

          <label className="label" style={{ marginBottom: 12 }}>
            Your groups
          </label>
          {groups.length === 0 ? (
            <p className="muted">No groups yet — create one above.</p>
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              {groups.map((g) => (
                <GroupCard key={g.id} group={g} onRename={renameGroup} onUpdateMembers={updateMembers} onDelete={deleteGroup} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GroupCard({ group, onRename, onUpdateMembers, onDelete }) {
  const [name, setName] = useState(group.name);
  const [memberInput, setMemberInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addMember = () => {
    const nm = memberInput.trim();
    if (!nm || group.members.includes(nm)) return;
    onUpdateMembers(group.id, [...group.members, nm]);
    setMemberInput("");
  };
  const removeMember = (nm) => {
    onUpdateMembers(group.id, group.members.filter((n) => n !== nm));
  };

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          onClick={() => onRename(group.id, name)}
          disabled={!name.trim() || name.trim() === group.name}
          className="btn btn-secondary btn-small"
        >
          Rename
        </button>
      </div>

      {group.members.length > 0 && (
        <div className="row-wrap" style={{ marginBottom: 10 }}>
          {group.members.map((m) => (
            <span key={m} className="pill" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {m}
              <button onClick={() => removeMember(m)} className="btn-ghost" style={{ padding: 0, fontSize: 12, lineHeight: 1 }}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={memberInput}
          onChange={(e) => setMemberInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
          placeholder="Add a name"
        />
        <button onClick={addMember} disabled={!memberInput.trim()} className="btn btn-secondary btn-small">
          + Add
        </button>
      </div>

      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className="btn-danger">
          🗑 Delete group
        </button>
      ) : (
        <div className="row">
          <span style={{ color: "var(--danger)", fontSize: 14 }}>Delete permanently?</span>
          <button
            onClick={() => onDelete(group.id)}
            className="btn btn-small"
            style={{ background: "var(--danger-bg)", color: "var(--danger-strong)" }}
          >
            Yes, delete
          </button>
          <button onClick={() => setConfirmDelete(false)} className="btn-ghost btn-small">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
