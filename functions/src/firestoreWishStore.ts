import type { Firestore } from "firebase-admin/firestore";
import { isStale, type WishStore } from "./refreshWishes.js";

export function firestoreWishStore(db: Firestore): WishStore {
  const wishRef = (userId: string, wishId: string) =>
    db.doc(`users/${userId}/wishes/${wishId}`);

  return {
    async list(userId) {
      const snapshot = await db.collection(`users/${userId}/wishes`).get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        link: doc.get("link"),
        fetchCheckedAt: doc.get("fetchCheckedAt"),
      }));
    },

    claim(userId, wishId, now) {
      const ref = wishRef(userId, wishId);
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (
          !snapshot.exists ||
          !isStale({ fetchCheckedAt: snapshot.get("fetchCheckedAt") }, now)
        ) {
          return false;
        }
        transaction.update(ref, { fetchCheckedAt: now });
        return true;
      });
    },

    async saveFetched(userId, wishId, fetched) {
      await wishRef(userId, wishId).update({ fetched });
    },
  };
}
