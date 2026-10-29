"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../providers/auth-provider";
import { errorMessage } from "../../lib/api";
import { safeReturnPath } from "../../lib/navigation";
import { ErrorAlert, Loading } from "../ui/feedback";
import { LoginIntro } from "./login-intro";
export function LoginForm() {
  const { user, checking, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const destination = safeReturnPath(params.get("next"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user && !checking) router.replace(destination);
  }, [user, checking, destination, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await login(String(form.get("email")), String(form.get("password")));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (checking || user) return <Loading>Проверяем сессию…</Loading>;
  return (
    <main className="login-shell">
      <LoginIntro />
      <section className="login-panel">
        <form onSubmit={submit} className="login-form">
          <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
          <h2>Вход в TripFlow</h2>
          <p className="muted">Используйте учётную запись сотрудника.</p>
          <ErrorAlert message={error} />
          <label>
            Электронная почта
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="name@example.test"
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              required
              maxLength={256}
              autoComplete="current-password"
            />
          </label>
          <button disabled={busy} className="primary">
            {busy ? "Входим…" : "Войти"}
          </button>
        </form>
      </section>
    </main>
  );
}
