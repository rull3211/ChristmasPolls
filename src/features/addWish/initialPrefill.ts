import { parsePrefill } from "./prefill";

// Read once when the page loads: the user may still have to sign in first,
// and the hash is removed so a reload does not fill the form again.
export const initialPrefill =
  typeof window === "undefined" ? null : parsePrefill(window.location.hash);

if (initialPrefill) {
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );
}
