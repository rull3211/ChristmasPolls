import { collection, getDocs } from "firebase/firestore";
import { db } from "../auth/firebase";
import type { StoredWish } from "./AddWishApi";
import { sortWishes } from "../../features/wishes/wishOrder";

export async function fetchWishes(userId: string): Promise<StoredWish[]> {
  if (!userId) throw new Error("Missing userId");

  const wishesRef = collection(db, `users/${userId}/wishes`);
  const snapshot = await getDocs(wishesRef);
  const wishes = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as StoredWish[];

  // A Firestore orderBy would drop wishes that have no order yet.
  return sortWishes(wishes);
}
