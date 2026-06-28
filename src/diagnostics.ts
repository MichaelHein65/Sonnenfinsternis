const STORAGE_KEY = 'umbra-diagnostics'
const MAX_ENTRIES = 50

export type DiagnosticDetails = Record<string, unknown>

export function logDiagnostic(event: string, details: DiagnosticDetails = {}) {
  const entry = {
    time: new Date().toISOString(),
    event,
    details,
    userAgent: navigator.userAgent,
  }

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown[]
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, entry].slice(-MAX_ENTRIES)))
  } catch { /* logging must never interrupt the app */ }

  fetch('/__umbra_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    keepalive: true,
  }).catch(() => undefined)

  console.warn(`[UMBRA] ${event}`, details)
}

export function installGlobalDiagnostics() {
  window.addEventListener('error', (event) => {
    logDiagnostic('window-error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    logDiagnostic('unhandled-rejection', { reason: String(event.reason) })
  })
}
