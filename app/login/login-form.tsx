"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { authenticate } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(authenticate, { error: undefined });

  return <form className="login-form" action={action}>
    <label htmlFor="email">Email address</label>
    <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
    <label htmlFor="password">Password</label>
    <input id="password" name="password" type="password" autoComplete="current-password" required />
    {state.error && <p className="form-message" role="alert">{state.error}</p>}
    <button className="button button-primary login-submit" disabled={pending}>{pending ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={16} />}Sign in securely</button>
    <p className="signup-login-link">Need an account? <Link href="/signup">Create one</Link></p>
  </form>;
}