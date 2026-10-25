import { doc, writeBatch } from "firebase/firestore";
import { db } from "../auth/firebase";

// One batch, so the list is never saved half reordered.
export async function saveWishOrder(
  userId: string,
  orderedIds: readonly string[]
): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, `users/${userId}/wishes/${id}`), { order: index });
  });
  await batch.commit();
}
