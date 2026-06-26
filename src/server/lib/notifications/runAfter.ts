/**
 * Fire-and-forget background work that must not block the HTTP response.
 *
 * Wraps Next's `after()` so it works in production (true deferred execution
 * after the response is flushed) while degrading gracefully to an immediate
 * unhandled promise when called outside a request scope — which is what
 * happens in unit tests that invoke the route handler directly.
 *
 * Always wraps the callback in a try/catch so a failing side-effect never
 * surfaces to the caller.
 */
export function safeAfter(work: () => Promise<unknown>): void {
  const safe = async () => {
    try {
      await work();
    } catch {
      // best-effort: notifications must never break the parent flow
    }
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as {
      after: (fn: () => Promise<unknown>) => void;
    };
    after(safe);
  } catch {
    // `after` threw outside a request scope (e.g. unit tests): run inline.
    void safe();
  }
}
