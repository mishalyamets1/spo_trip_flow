"use client";
import { ErrorAlert } from "../../components/ui/feedback";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorAlert
      message="Не удалось открыть страницу. Попробуйте ещё раз."
      onRetry={reset}
    />
  );
}
