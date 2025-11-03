import { getAuth } from "firebase/auth";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../auth/firebase";

export type Wish = {
  name: string;
  link: string;
  price: string;
  comment: string;
  id?: string;
};

export async function addWish(wish: Wish) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const wishesRef = collection(db, `users/${user.uid}/wishes`);
  const docRef = await addDoc(wishesRef, wish);

  return { id: docRef.id, ...wish };
}

export async function patchWish(wish: Wish) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  if (!wish.id) throw new Error("Whould be Updating wish");

  const wishRef = doc(db, `users/${user.uid}/wishes/${wish.id}`);
  await updateDoc(wishRef, wish);

  return { ...wish };
}
