import { getAuth } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../auth/firebase";

export type Wish = {
  name: string;
  link: string;
  price: string;
};

export async function addWish(wish: Wish) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const wishesRef = collection(db, `users/${user.uid}/wishes`);
  const docRef = await addDoc(wishesRef, wish);

  return { id: docRef.id, ...wish };
}
