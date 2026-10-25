import { httpsCallable } from "firebase/functions";
import { functions } from "../auth/firebase";

const callable = httpsCallable<
  { userId: string },
  { checked: number; updated: number }
>(functions, "refreshWishes", { timeout: 120_000 });

export async function refreshWishes(userId: string) {
  const result = await callable({ userId });
  return result.data;
}
