export type Participant = { id: string; spouseId?: string };
export type Assignment = { giverId: string; receiverId: string };

const MAX_ATTEMPTS = 10_000;

function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A pair is blocked if either side's profile names the other as spouse.
function canDraw(giver: Participant, receiver: Participant): boolean {
  return (
    giver.id !== receiver.id &&
    giver.spouseId !== receiver.id &&
    receiver.spouseId !== giver.id
  );
}

// Rejection sampling keeps the result uniform among valid draws.
export function drawSecretSanta(participants: readonly Participant[]): Assignment[] {
  if (participants.length < 2) {
    throw new Error("Det må være minst to deltakere for å trekke.");
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const receivers = shuffle(participants);
    if (participants.every((giver, i) => canDraw(giver, receivers[i]))) {
      return participants.map((giver, i) => ({
        giverId: giver.id,
        receiverId: receivers[i].id,
      }));
    }
  }

  throw new Error(
    "Fant ingen gyldig trekning. Sjekk at partnerne er registrert riktig."
  );
}
