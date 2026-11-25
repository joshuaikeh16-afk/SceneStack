"use client";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import type { ProductBootstrap, ActionReply } from "@/types/product";

type Notice = { id: number; message: string; error: boolean };
const Context = createContext<{
  bootstrap: ProductBootstrap;
  online: boolean;
  toast: (message: string, error?: boolean) => void;
} | null>(null);
export function ProductProviders({
  bootstrap,
  children,
}: {
  bootstrap: ProductBootstrap;
  children: ReactNode;
}) {
  const online = useSyncExternalStore(
    subscribeConnection,
    () => navigator.onLine,
    () => true,
  );
  const [client] = useState(() => {
    const value = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
        mutations: { retry: 0, networkMode: "always" },
      },
    });
    value.setQueryDefaults(["collection-draft"], { gcTime: Infinity });
    return value;
  });
  const [notices, setNotices] = useState<Notice[]>([]);
  const previous = useRef(bootstrap.userId);
  useEffect(() => {
    if (previous.current !== bootstrap.userId) {
      client.clear();
      if ("serviceWorker" in navigator)
        navigator.serviceWorker.controller?.postMessage({
          type: "CLEAR_PUBLIC_PAGES",
        });
      previous.current = bootstrap.userId;
    }
  }, [bootstrap.userId, client]);
  function toast(message: string, error = false) {
    const id = Date.now() + Math.random();
    setNotices((old) =>
      old.some((n) => n.message === message && n.error === error)
        ? old
        : [...old.slice(-2), { id, message, error }],
    );
    window.setTimeout(
      () => setNotices((old) => old.filter((n) => n.id !== id)),
      6000,
    );
  }
  return (
    <QueryClientProvider client={client}>
      <Context.Provider value={{ bootstrap, toast, online }}>
        {!online && (
          <div className="offline-banner" role="status">
            You’re offline. Saved public pages may be available; changes need a
            connection.
          </div>
        )}
        {children}
        <div className="toast-stack" aria-live="polite" aria-atomic="false">
          {notices.map((n) => (
            <div
              className={`toast ${n.error ? "toast-error" : ""}`}
              role={n.error ? "alert" : "status"}
              key={n.id}
            >
              {n.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{n.message}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() =>
                  setNotices((old) => old.filter((item) => item.id !== n.id))
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </Context.Provider>
    </QueryClientProvider>
  );
}
export function useProduct() {
  const context = useContext(Context);
  if (!context) throw new Error("Product provider missing.");
  return context;
}
export class DataRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAt: number = 0,
  ) {
    super(message);
  }
}

export async function fetchData<T>(
  resource: string,
  params: Record<string, string | number | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") q.set(key, String(value));
  });
  const response = await fetch(
    `/api/data/${resource}${q.size ? `?${q}` : ""}`,
    { signal, cache: "no-store" },
  );
  if (response.ok) return (await response.json()) as T;
  const payload = await response.json().catch(() => null);
  const retryAfter = response.headers.get("retry-after");
  const now = Date.now();
  const retryAt =
    retryAfter && /^\d+$/.test(retryAfter)
      ? now + Number(retryAfter) * 1000
      : Date.parse(retryAfter || "");
  throw new DataRequestError(
    payload?.message || "This data is temporarily unavailable.",
    response.status,
    Number.isFinite(retryAt)
      ? retryAt
      : response.status === 429
        ? now + 30000
        : 0,
  );
}
export function unwrap<T>(reply: ActionReply<T>): T {
  if (!reply.ok) throw new Error(reply.message);
  return reply.data;
}
export function useInvalidateProduct() {
  const client = useQueryClient();
  const { bootstrap } = useProduct();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["library", bootstrap.userId] }),
      client.invalidateQueries({ queryKey: ["collections", bootstrap.userId] }),
      client.invalidateQueries({ queryKey: ["collection"] }),
      client.invalidateQueries({ queryKey: ["profile"] }),
      client.invalidateQueries({ queryKey: ["continue", bootstrap.userId] }),
      client.invalidateQueries({ queryKey: ["feed", bootstrap.userId] }),
      client.invalidateQueries({
        queryKey: ["search-history", bootstrap.userId],
      }),
      client.invalidateQueries({
        queryKey: ["notifications", bootstrap.userId],
      }),
      client.invalidateQueries({
        queryKey: ["recommendations", bootstrap.userId],
      }),
    ]);
  };
}

function subscribeConnection(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
