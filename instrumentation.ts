// Runs once when the server starts. The NEXT_RUNTIME check must stay a plain `if` so the Node-only
// code is stripped from the edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
