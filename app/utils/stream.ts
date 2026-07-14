// Thin wrapper around the platform `fetch`. Historically this dispatched to a
// Tauri command for the desktop build; the desktop app has been removed, so it
// now always uses the standard runtime `fetch`.
export function fetch(url: string, options?: RequestInit): Promise<Response> {
  return globalThis.fetch(url, options);
}
