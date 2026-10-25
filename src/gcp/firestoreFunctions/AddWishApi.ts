import { getAuth } from "firebase/auth";
import {
  collection,
  addDoc,
  updateDoc,
  deleteField,
  doc,
} from "firebase/firestore";
import { db } from "../auth/firebase";

export type FetchedInfo = {
  name: string | null;
  price: number | null;
  currency: string | null;
  source: "jsonld" | "opengraph";
  fetchedAt: number;
};

export type Wish = {
  name: string;
  link: string;
  price: string;
  comment: string;
  id?: string;
  fetched?: FetchedInfo;
  fetchCheckedAt?: number;
};

export type StoredWish = Wish & { id: string };

function typedFields(wish: Wish) {
  return {
    name: wish.name,
    link: wish.link,
    price: wish.price,
    comment: wish.comment,
  };
}

export async function addWish(wish: Wish) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const wishesRef = collection(db, `users/${user.uid}/wishes`);
  const docRef = await addDoc(wishesRef, {
    ...typedFields(wish),
    ...(wish.fetched && { fetched: wish.fetched }),
    ...(wish.fetchCheckedAt !== undefined && {
      fetchCheckedAt: wish.fetchCheckedAt,
    }),
  });

  return { id: docRef.id, ...wish };
}

export async function patchWish(wish: Wish) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  if (!wish.id) throw new Error("Whould be Updating wish");

  const wishRef = doc(db, `users/${user.uid}/wishes/${wish.id}`);
  await updateDoc(wishRef, {
    ...typedFields(wish),
    fetched: wish.fetched ?? deleteField(),
    fetchCheckedAt: wish.fetchCheckedAt ?? deleteField(),
  });

  return { ...wish };
}
