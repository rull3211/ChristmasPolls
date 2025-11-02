import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../auth/firebase";

export async function deleteWish(userId: string, wishId: string) {
  if (!userId || !wishId) throw new Error("Missing userId or wishId");

  const ref = doc(db, `users/${userId}/wishes/${wishId}`);
  await deleteDoc(ref);
  return wishId; // return deleted id for UI update
}
