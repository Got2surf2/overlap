import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import CalendarMark from "../components/CalendarMark";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  const goToCode = () => {
    const code = joinCode.trim().toUpperCase();
    if (code) router.push(`/poll/${code}`);
  };

  return (
    <div className="page">
      <Head>
        <title>Overlap — find a time everyone can make</title>
      </Head>
      <Link href="/" className="brand">
        <span className="brand-mark"><CalendarMark /></span>
        <span className="brand-name">Overlap</span>
      </Link>

      <h1 className="hero">
        Find the time
        <br />
        everyone can make.
      </h1>
      <p className="subtitle">Propose a few times. Share a link. Watch the overlap appear.</p>

      <Link href="/create" className="btn btn-primary" style={{ marginBottom: 32, textDecoration: "none" }}>
        + Start a new poll
      </Link>

      <hr className="divider" style={{ marginTop: 0 }} />

      <p className="label">Have a code instead of a link?</p>
      <div className="row">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && goToCode()}
          placeholder="e.g. K3P9QZ"
          maxLength={8}
          className="mono"
        />
        <button onClick={goToCode} disabled={!joinCode.trim()} className="btn btn-secondary">
          Go
        </button>
      </div>
    </div>
  );
}
