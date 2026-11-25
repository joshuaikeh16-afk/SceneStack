import { DataRequestError } from "./providers";

// Each browser QueryClient has its own queue and shares the server's backoff
// across shelves. A discarded search leaves the queue immediately.
class FeedRequests {
  private active = 0;
  private waiting = new Set<() => void>();
  private limited: DataRequestError | undefined;

  async run<T>(signal: AbortSignal, fetchPage: () => Promise<T>) {
    signal.throwIfAborted();
    if (this.active >= 3) {
      await new Promise<void>((resolve, reject) => {
        const start = () => {
          this.waiting.delete(start);
          signal.removeEventListener("abort", abort);
          this.active++;
          resolve();
        };
        const abort = () => {
          this.waiting.delete(start);
          reject(signal.reason);
        };
        this.waiting.add(start);
        signal.addEventListener("abort", abort, { once: true });
      });
    } else {
      this.active++;
    }
    try {
      signal.throwIfAborted();
      if (this.limited && this.limited.retryAt > Date.now()) throw this.limited;
      return await fetchPage();
    } catch (error) {
      if (
        error instanceof DataRequestError &&
        error.retryAt > (this.limited?.retryAt ?? 0)
      )
        this.limited = error;
      throw error;
    } finally {
      this.active--;
      this.waiting.values().next().value?.();
    }
  }
}

const clients = new WeakMap<object, FeedRequests>();
export function feedRequests(client: object) {
  let requests = clients.get(client);
  if (!requests) {
    requests = new FeedRequests();
    clients.set(client, requests);
  }
  return requests;
}
