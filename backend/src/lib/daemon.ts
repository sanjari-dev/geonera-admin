/**
 * Authenticated fetch helper for the Go Ingestion daemon.
 *
 * All outbound calls from this backend to the Go service MUST go through
 * daemonFetch so the X-Ingestion-Secret header is injected automatically.
 * The header is read once at module load time; changing GO_INGESTION_SECRET
 * requires a process restart.
 *
 * If GO_INGESTION_SECRET is not set, the header is omitted and a startup
 * warning is printed. The Go side mirrors this: if INGESTION_SECRET is not
 * set there either, it skips verification — both sides must be configured
 * together for the security layer to be effective.
 */

const DAEMON_BASE = (): string => process.env.GO_DAEMON_URL ?? ''
const DAEMON_SECRET = process.env.GO_INGESTION_SECRET ?? ''

if (!DAEMON_SECRET) {
  console.warn(
    '⚠  GO_INGESTION_SECRET not set — requests to the Go Ingestion daemon are unauthenticated.\n' +
    '   Set GO_INGESTION_SECRET (must match INGESTION_SECRET on the Go side) in .env.'
  )
}

function injectSecret(init: RequestInit = {}): RequestInit {
  if (!DAEMON_SECRET) return init
  return {
    ...init,
    headers: {
      'X-Ingestion-Secret': DAEMON_SECRET,
      ...(init.headers ?? {}),
    },
  }
}

/**
 * Fetches a path relative to GO_DAEMON_URL, always injecting X-Ingestion-Secret.
 *
 * @param path  Relative path, e.g. '/runtime' or '/ticks/regular'.
 *              Must start with '/'.
 * @param init  Standard RequestInit (method, headers, signal, …).
 */
export function daemonFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${DAEMON_BASE()}${path}`, injectSecret(init))
}
