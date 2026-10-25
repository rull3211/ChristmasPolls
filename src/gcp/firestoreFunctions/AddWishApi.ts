import { getAuth } from "firebase/auth";
import {
  collection,
  updateDoc,
  deleteField,
  doc,
  writeBatch,
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
  // Position in the owner's priority list, 0 is wanted most.
  order?: number;
};

export type StoredWish = Wish & { id: string };

// Only what the user typed. Fetched data is written by the server alone.
function typedFields(wish: Wish) {
  return {
    name: wish.name,
    link: wish.link,
    price: wish.price,
    comment: wish.comment,
  };
}

// One batch, so ranking the existing wishes and adding the new one last can
// never be seen half done.
export async function addWish(wish: Wish, rankExisting: readonly string[] = []) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const wishesRef = collection(db, `users/${user.uid}/wishes`);
  const newRef = doc(wishesRef);
  const batch = writeBatch(db);
  rankExisting.forEach((id, index) =>
    batch.update(doc(wishesRef, id), { order: index })
  );
  batch.set(newRef, {
    ...typedFields(wish),
    ...(wish.order !== undefined && { order: wish.order }),
  });
  await batch.commit();

  return { id: newRef.id, ...wish };
}

// A new link makes the old fetched data wrong, so it is cleared and the
// server fetches again.
export async function patchWish(wish: Wish, clearFetched: boolean) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  if (!wish.id) throw new Error("Whould be Updating wish");

  const wishRef = doc(db, `users/${user.uid}/wishes/${wish.id}`);
  await updateDoc(wishRef, {
    ...typedFields(wish),
    ...(clearFetched && {
      fetched: deleteField(),
      fetchCheckedAt: deleteField(),
    }),
  });

  return { ...wish };
}
