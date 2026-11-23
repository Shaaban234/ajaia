"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { IconAlert, IconArrowRight, IconFeather } from "@/components/Icons";

const DEMO = [
  { id: "u_alice", name: "Alice Khan", email: "alice@ajaia.test", blurb: "Owns the sample docs" },
  { id: "u_bob", name: "Bob Martin", email: "bob@ajaia.test", blurb: "Test view-only sharing" },
  { id: "u_carol", name: "Carol Diaz", email: "carol@ajaia.test", blurb: "Test edit sharing" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(asEmail?: string) {
    const em = asEmail ?? email;
    setBusy(asEmail ?? "form");
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, password: asEmail ? "demo1234" : password }),
    });
    if (!res.ok) {
      setBusy(null);
      return setError((await res.json()).error ?? "Sign-in failed.");
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth">
      <section className="auth-art">
        <div className="brand"><span className="brand-mark"><IconFeather /></span>Ajaia Docs</div>
        <div className="anim-fade-up">
          <h1>Write together, without the clutter.</h1>
          <p>Create rich documents, import your existing files, and share them with exactly the access each teammate needs.</p>
        </div>
        <p style={{ fontSize: 13, opacity: .7 }}>Built for the Ajaia AI-Native Full Stack assignment</p>
        <div className="float-doc" aria-hidden>
          <div className="h">Q4 Launch Plan</div>
          <div className="l" style={{ width: "92%" }} /><div className="l" style={{ width: "80%" }} /><div className="l" style={{ width: "86%" }} />
          <div className="l" style={{ width: "60%" }} />
          <div className="avatars avatar-stack">
            {DEMO.map((u) => <Avatar key={u.id} name={u.name} id={u.id} />)}
          </div>
        </div>
      </section>

      <section className="auth-form">
        <div className="auth-card">
          <h2>Welcome back</h2>
          <p className="muted" style={{ fontSize: 14, margin: "0 0 24px" }}>Pick a demo account below, or sign in manually. The password for every account is <code>demo1234</code>.</p>

          <div className="stagger">
            {DEMO.map((u) => (
              <button key={u.id} className="persona" disabled={!!busy} onClick={() => signIn(u.email)}>
                <Avatar name={u.name} id={u.id} size="lg" />
                <div><strong>{u.name}</strong><span>{u.email} · {u.blurb}</span></div>
                <span className="go">{busy === u.email ? <span className="spinner" /> : <IconArrowRight />}</span>
              </button>
            ))}
          </div>

          <div className="divider">or sign in with email</div>
          <form onSubmit={(e) => { e.preventDefault(); signIn(); }}>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" placeholder="alice@ajaia.test" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="field">
              <label className="label" htmlFor="pw">Password</label>
              <input id="pw" className="input" type="password" placeholder="demo1234" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {error && <div className="error-box" role="alert" style={{ marginBottom: 14 }}><IconAlert width={16} />{error}</div>}
            <button className="btn btn-primary btn-block" disabled={!!busy || !email || !password}>
              {busy === "form" ? <span className="spinner" /> : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
