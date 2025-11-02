import { collection, getDocs } from "firebase/firestore";
import { db } from "../auth/firebase";
import type { User } from "../../types/User";

export async function fetchUserProfiles() {
  const snapshot = await getDocs(collection(db, "userProfiles"));

  // Map each document to include id + data
  const profiles = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as User[];

  return profiles;
}
