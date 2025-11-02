import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../auth/firebase";

export async function fetchWishes(userId: string) {
  if (!userId) throw new Error("Missing userId");

  const wishesRef = collection(db, `users/${userId}/wishes`);
  const q = query(wishesRef, orderBy("name", "asc")); // optional sorting
  const snapshot = await getDocs(q);
  const wishes = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return wishes;
}
