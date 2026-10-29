import type { ReactNode } from "react";
export function Loading({ children = "Загружаем…" }: { children?: ReactNode }) {
  return (
    <div className="empty" role="status" aria-busy="true">
      {children}
    </div>
  );
}
export function ErrorAlert({
  message,
  onRetry,
  retryLabel = "Повторить",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (!message) return null;
  return (
    <div className="alert error" role="alert">
      {message}
      {onRetry && (
        <button type="button" className="text-button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="alert success" role="status">
      {children}
    </div>
  );
}
