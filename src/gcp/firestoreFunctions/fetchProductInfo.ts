import { httpsCallable } from "firebase/functions";
import { functions } from "../auth/firebase";

export type ProductInfo = {
  name: string | null;
  price: number | null;
  currency: string | null;
  source: "jsonld" | "opengraph" | null;
  finalUrl: string | null;
  reason: string | null;
};

const callable = httpsCallable<{ url: string }, ProductInfo>(
  functions,
  "fetchProductInfo",
  { timeout: 25_000 }
);

export async function fetchProductInfo(url: string): Promise<ProductInfo> {
  const result = await callable({ url });
  return result.data;
}
