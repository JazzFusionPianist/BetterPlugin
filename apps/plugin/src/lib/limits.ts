/**
 * Size ceilings, in one place, with the reason each one exists.
 *
 * Every number here is a floor we can raise after measuring — a guard
 * that is too tight shows a note and the user tries another route; one
 * that is too loose kills the plug-in window and the user never learns
 * what was lost. So they start low.
 */

/** One attachment on any route. The R2 PUT streams the File from disk,
 *  so this is a product number, not a memory one. */
export const UPLOAD_FILE_LIMIT = 1000 * 1024 * 1024

/** One region dragged in from the DAW. The native bridge base64-encodes
 *  the whole file into a JS string (×1.33) and JS decodes it back (×1)
 *  before anything else happens — and WebView2/Chromium (the Windows
 *  host) caps a single string near 512 MB, which base64 of 300 MB
 *  stays under. macOS (JavaScriptCore) is looser but hits the same
 *  memory wall not far past this. */
export const DAW_FILE_LIMIT = 300 * 1024 * 1024

/** The merged WAV. Rendering holds the float32 output (×1.33 of a
 *  24-bit file) plus one decoded input at a time. */
export const MERGED_OUTPUT_LIMIT = 500 * 1024 * 1024

/** Sum of files going into one zip. The archive is built in memory:
 *  every file's bytes plus the Blob's own copy, ≈ 2× the total. Over
 *  this, "send separately" streams each file instead. */
export const ZIP_TOTAL_LIMIT = 500 * 1024 * 1024

export function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  if (n < 1000 * 1024 * 1024) return `${Math.round(n / 1024 / 1024)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}
