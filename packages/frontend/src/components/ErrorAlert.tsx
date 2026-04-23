import type { ApiError } from "../lib/api";

type Props = {
  error?: ApiError | null;
  fallback?: string;
  className?: string;
};

export default function ErrorAlert({ error, fallback, className }: Props) {
  const message = error?.message ?? fallback;
  if (!message) return null;
  return <p className={className ?? "error-msg"}>{message}</p>;
}
