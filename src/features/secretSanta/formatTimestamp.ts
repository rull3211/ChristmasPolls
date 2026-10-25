import type { Timestamp } from "firebase/firestore";

export function formatTimestamp(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleString("nb-NO", {
    dateStyle: "long",
    timeStyle: "short",
  });
}
