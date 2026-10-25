import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";
import { logger } from "firebase-functions";
import { firestoreWishStore } from "./firestoreWishStore.js";
import { getProductInfo } from "./productInfo.js";
import { refreshUserWishes } from "./refreshWishes.js";

initializeApp();

const callableOptions = {
  region: "europe-west1",
  memory: "256MiB",
  maxInstances: 3,
  cors:
    process.env.FUNCTIONS_EMULATOR === "true"
      ? true
      : [
          "https://christmaspolls.web.app",
          "https://christmaspolls.firebaseapp.com",
          "http://localhost:5173",
        ],
} as const;

// Anyone can sign in with Google, but the Firestore rules only let
// whitelisted emails create a profile, so a profile means family.
async function requireFamilyMember(uid: string | undefined): Promise<void> {
  if (!uid) throw new HttpsError("unauthenticated", "Logg inn først.");
  const profile = await getFirestore().doc(`userProfiles/${uid}`).get();
  if (!profile.exists) {
    throw new HttpsError("permission-denied", "Ingen tilgang.");
  }
}

export const fetchProductInfo = onCall(
  { ...callableOptions, timeoutSeconds: 30 },
  async (request) => {
    await requireFamilyMember(request.auth?.uid);

    const url: unknown = request.data?.url;
    if (typeof url !== "string") {
      throw new HttpsError("invalid-argument", "url må være tekst.");
    }
    return getProductInfo(url);
  }
);

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;

// Any family member may refresh any list, since only a visitor's click can
// trigger it; the wishes are written here with admin rights, and only the
// fetched data, never what the owner typed.
export const refreshWishes = onCall(
  { ...callableOptions, timeoutSeconds: 120 },
  async (request) => {
    await requireFamilyMember(request.auth?.uid);

    const userId: unknown = request.data?.userId;
    if (typeof userId !== "string" || !USER_ID.test(userId)) {
      throw new HttpsError("invalid-argument", "userId er ugyldig.");
    }
    const db = getFirestore();
    if (!(await db.doc(`userProfiles/${userId}`).get()).exists) {
      throw new HttpsError("not-found", "Fant ikke brukeren.");
    }

    return refreshUserWishes(
      firestoreWishStore(db),
      userId,
      getProductInfo,
      Date.now,
      (message, error) => logger.warn(message, error)
    );
  }
);
