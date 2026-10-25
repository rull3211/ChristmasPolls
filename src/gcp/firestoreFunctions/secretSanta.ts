import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../auth/firebase";
import {
  drawSecretSanta,
  type Participant,
} from "../../features/secretSanta/draw";

export type ActiveDraw = {
  activeDrawId: string;
  announcedAt: Timestamp;
  activatedAt: Timestamp;
  activatedBy: string;
};

export type DrawSummary = {
  id: string;
  createdAt: Timestamp;
  createdBy: string;
  participantCount: number;
};

export type MyAssignment = {
  receiverId: string;
  announcedAt: Timestamp;
};

const activeDrawRef = doc(db, "secretSanta", "current");

export async function fetchActiveDraw(): Promise<ActiveDraw | null> {
  const snap = await getDoc(activeDrawRef);
  return snap.exists() ? (snap.data() as ActiveDraw) : null;
}

export async function fetchMyAssignment(
  userId: string
): Promise<MyAssignment | null> {
  const active = await fetchActiveDraw();
  if (!active) return null;

  const snap = await getDoc(
    doc(db, `secretSantaDraws/${active.activeDrawId}/assignments/${userId}`)
  );
  if (!snap.exists()) return null;

  return {
    receiverId: snap.data().receiverId as string,
    announcedAt: active.announcedAt,
  };
}

export async function fetchDraws(): Promise<DrawSummary[]> {
  const snapshot = await getDocs(
    query(collection(db, "secretSantaDraws"), orderBy("createdAt", "desc"))
  );
  return snapshot.docs.map((d) => ({
    id: d.id,
    createdAt: d.data().createdAt as Timestamp,
    createdBy: d.data().createdBy as string,
    participantCount: (d.data().participantIds as string[]).length,
  }));
}

// A new draw is a new document and the pointer moves to it, so the previous
// draw stays untouched as a backup that rollbackToDraw can reactivate.
export async function startDraw(adminId: string): Promise<void> {
  const profiles = await getDocs(collection(db, "userProfiles"));
  const participants: Participant[] = profiles.docs.map((d) => ({
    id: d.id,
    spouseId: d.data().spouseId as string | undefined,
  }));
  const assignments = drawSecretSanta(participants);

  const drawRef = doc(collection(db, "secretSantaDraws"));
  const batch = writeBatch(db);
  batch.set(drawRef, {
    createdAt: serverTimestamp(),
    createdBy: adminId,
    participantIds: participants.map((p) => p.id),
  });
  for (const { giverId, receiverId } of assignments) {
    batch.set(doc(drawRef, "assignments", giverId), { receiverId });
  }
  batch.set(activeDrawRef, {
    activeDrawId: drawRef.id,
    announcedAt: serverTimestamp(),
    activatedAt: serverTimestamp(),
    activatedBy: adminId,
  });
  await batch.commit();
}

export async function rollbackToDraw(
  draw: DrawSummary,
  adminId: string
): Promise<void> {
  await setDoc(activeDrawRef, {
    activeDrawId: draw.id,
    announcedAt: draw.createdAt,
    activatedAt: serverTimestamp(),
    activatedBy: adminId,
  });
}
