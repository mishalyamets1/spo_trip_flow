import { Suspense } from "react";
import { LoginForm } from "../../components/auth/login-form";
import { Loading } from "../../components/ui/feedback";
export const metadata = { title: "Вход — TripFlow" };
export default function LoginPage() {
  return (
    <Suspense fallback={<Loading>Загружаем страницу входа…</Loading>}>
      <LoginForm />
    </Suspense>
  );
}
