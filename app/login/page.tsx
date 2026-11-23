"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO = [
  { name: "Alice Khan", email: "alice@ajaia.test" },
  { name: "Bob Martin", email: "bob@ajaia.test" },
  { name: "Carol Diaz", email: "carol@ajaia.test" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("alice@ajaia.test");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e?: React.FormEvent, asEmail?: string) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: asEmail ?? email, password: asEmail ? "demo1234" : password }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "Sign-in failed.");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <form className="card" style={{ width: 380 }} onSubmit={signIn}>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Ajaia Docs</h1>
        <p className="muted">Demo sign-in. All accounts use the password <code>demo1234</code>.</p>
        <label className="muted">Email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <div style={{ height: 10 }} />
        <label className="muted">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p className="error">{error}</p>}
        <div style={{ height: 14 }} />
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="muted" style={{ marginTop: 18 }}>Or continue as a demo user:</p>
        <div className="demo-users">
          {DEMO.map((u) => (
            <button key={u.email} type="button" className="btn" disabled={busy} onClick={() => signIn(undefined, u.email)}>
              {u.name} <span className="muted">· {u.email}</span>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
