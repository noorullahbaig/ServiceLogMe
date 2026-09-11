"use client";

import { ArrowRight, CheckCircle2, FileCheck2, Lock, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const accounts = {
  admin: { label: "Administrator", detail: "Office workspace", email: "sarah@servicelogme.app", password: "ServiceLOGME#Office" },
  field: { label: "Field technician", detail: "Mobile workspace", email: "amir@servicelogme.app", password: "ServiceLOGME#Field" },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<keyof typeof accounts | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function choose(role: keyof typeof accounts) {
    setSelected(role);
    setEmail(accounts[role].email);
    setPassword(accounts[role].password);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Unable to sign in.");
      const user = await fetch("/api/auth/session", { cache: "no-store" }).then((result) => result.json()) as { user?: { role?: string } };
      router.replace(user.user?.role === "EMPLOYEE" ? "/field" : "/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-brand"><span><FileCheck2 size={18} /></span>ServiceLOGME</div>
        <div className="login-story-copy">
          <p className="login-eyebrow">Service operations workspace</p>
          <h1>Every visit, clearly recorded.</h1>
          <p>Capture service work, customer sign-off, and ready-to-share reports in one connected workspace.</p>
          <div className="login-story-lines"><span>Service notes</span><span>Customer records</span><span>Signed reports</span></div>
        </div>
        <p className="login-story-footer">Structured records for teams that keep work moving.</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-mark"><FileCheck2 size={20} /></div>
          <p className="login-eyebrow">ServiceLOGME</p>
          <h2>Sign in</h2>
          <p className="login-intro">Enter your workspace to continue.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <form className="login-form" onSubmit={submit}>
            <label>Email address<input value={email} onChange={(event) => { setEmail(event.target.value); setSelected(null); }} type="email" autoComplete="username" required /></label>
            <label>Password<input value={password} onChange={(event) => { setPassword(event.target.value); setSelected(null); }} type="password" autoComplete="current-password" required /></label>
            <button className="btn btn-primary login-submit" disabled={busy}>{busy ? "Signing in…" : <>Enter workspace <ArrowRight size={16} /></>}</button>
          </form>
          <div className="login-divider"><span>Workspace access</span></div>
          <div className="login-roles">
            {(Object.entries(accounts) as [keyof typeof accounts, (typeof accounts)[keyof typeof accounts]][]).map(([role, account]) => (
              <button key={role} type="button" className={`login-role ${selected === role ? "selected" : ""}`} aria-pressed={selected === role} onClick={() => choose(role)}>
                <span className="login-role-icon">{role === "admin" ? <ShieldCheck size={17} /> : <UserRound size={17} />}</span>
                <span><strong>{account.label}</strong><small>{account.detail}</small></span>
                {selected === role && <CheckCircle2 className="login-role-check" size={16} />}
              </button>
            ))}
          </div>
          <p className="login-secure"><Lock size={13} /> Secure session on this device</p>
        </div>
      </section>
    </main>
  );
}

