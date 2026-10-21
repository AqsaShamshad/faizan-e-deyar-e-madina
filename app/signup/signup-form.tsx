"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle, UserRoundPlus } from "lucide-react";
import { createAccount } from "./actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(createAccount, {});

  return (
    <form className="login-form signup-form" action={action}>
      <label htmlFor="name">Your name</label>
      <input id="name" name="name" type="text" autoComplete="name" maxLength={120} required autoFocus />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      <label htmlFor="confirmPassword">Confirm password</label>
      <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
      {state.error && <p className="form-message" role="alert">{state.error}</p>}
      <button className="button button-primary login-submit" disabled={pending}>
        {pending ? <LoaderCircle className="spin" size={17} /> : <UserRoundPlus size={16} />}
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="signup-login-link">Already registered? <Link href="/login">Sign in</Link></p>
    </form>
  );
}