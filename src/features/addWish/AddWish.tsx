import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addWish,
  patchWish,
  type FetchedInfo,
  type Wish,
} from "../../gcp/firestoreFunctions/AddWishApi";
import {
  fetchProductInfo,
  type ProductInfo,
} from "../../gcp/firestoreFunctions/fetchProductInfo";
import { useAuth } from "../../hooks/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { formatPrice } from "../wishes/displayWish";
import { BookmarkletHelp } from "../bookmarklet/BookmarkletHelp";
import { normalizeLink } from "./normalizeLink";
import type { Prefill } from "./prefill";
import {
  Box,
  Button,
  Link,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

const EMPTY_WISH: Wish = { name: "", link: "", price: "", comment: "" };

// Failures that look like the shop refusing us, as opposed to a bad link.
const REFUSED_REASONS = new Set([
  "http_error",
  "timeout",
  "network_error",
  "too_many_redirects",
]);

function describeLookup(info: ProductInfo | undefined): {
  text: string;
  refused: boolean;
} {
  const plain = (text: string) => ({ text, refused: false });
  if (!info) {
    return plain("Kunne ikke hente fra linken. Fyll inn navn og pris under.");
  }
  const price =
    info.price !== null ? formatPrice(info.price, info.currency) : null;
  if (info.name && price) return plain(`Fant: ${info.name} — ${price}`);
  if (info.name) {
    return plain(
      `Fant navnet «${info.name}», men ikke prisen. Fyll inn pris under.`
    );
  }
  if (price) {
    return plain(`Fant prisen ${price}, men ikke navnet. Fyll inn navn under.`);
  }
  if (info.reason && REFUSED_REASONS.has(info.reason)) {
    return {
      text: "Butikken lar oss ikke hente fra siden automatisk. Fyll inn navn og pris under, eller bruk bokmerket.",
      refused: true,
    };
  }
  return plain("Fant ikke navn og pris på siden. Fyll dem inn under.");
}

function wishFromPrefill(prefill: Prefill | null | undefined): Wish | null {
  return prefill
    ? { ...EMPTY_WISH, link: prefill.link, name: prefill.name, price: prefill.price }
    : null;
}

function toFetched(info: ProductInfo | undefined): FetchedInfo | undefined {
  if (!info?.source || (info.name === null && info.price === null)) return;
  return {
    name: info.name,
    price: info.price,
    currency: info.currency,
    source: info.source,
    fetchedAt: Date.now(),
  };
}

export function AddWish({
  selectedToUpdate,
  handleUpdateSelect,
  prefill,
  onPrefillUsed,
}: {
  selectedToUpdate: Wish | null;
  handleUpdateSelect: (wish: Wish | null) => void;
  prefill?: Prefill | null;
  onPrefillUsed?: () => void;
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [formData, setFormData] = useState<Wish>(
    selectedToUpdate || wishFromPrefill(prefill) || EMPTY_WISH
  );

  const link = normalizeLink(formData.link);
  const debouncedLink = useDebouncedValue(link, 700);
  const lookup = useQuery({
    queryKey: ["productInfo", debouncedLink],
    queryFn: () => fetchProductInfo(debouncedLink as string),
    enabled: debouncedLink !== null,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const settling =
    link !== debouncedLink || (debouncedLink !== null && lookup.isFetching);
  const info = !settling && link !== null ? lookup.data : undefined;

  const { mutate, isPending, error } = useMutation({
    mutationFn: addWish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishes", user?.uid] });
      setFormData(EMPTY_WISH); // reset form
      setShowSuccess(true); // show message
      onPrefillUsed?.();
    },
  });
  const { mutate: update } = useMutation({
    mutationFn: patchWish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishes", user?.uid] });
      setFormData(EMPTY_WISH); // reset form
      setShowSuccess(true); // show message
    },
  });
  // Skips the first run so a prefilled form is not wiped on mount.
  const lastSelected = useRef(selectedToUpdate);
  useEffect(() => {
    if (lastSelected.current === selectedToUpdate) return;
    lastSelected.current = selectedToUpdate;
    setFormData(selectedToUpdate || EMPTY_WISH);
  }, [selectedToUpdate]);
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link === null || settling) return;

    // A failed lookup must not wipe what an earlier save found for the same link.
    const keepsLink =
      selectedToUpdate !== null &&
      normalizeLink(selectedToUpdate.link) === link;
    const fetched =
      toFetched(info) ?? (keepsLink ? selectedToUpdate.fetched : undefined);
    // A finished lookup counts as checked even if it found nothing, so the
    // daily refresh does not repeat it straight away.
    const fetchCheckedAt = info
      ? Date.now()
      : keepsLink
      ? selectedToUpdate.fetchCheckedAt
      : undefined;
    const wish: Wish = { ...formData, link, fetched, fetchCheckedAt };

    if (selectedToUpdate) {
      handleUpdateSelect(null);
      update(wish);
    } else mutate(wish);
  };

  const invalidLink = formData.link.trim() !== "" && link === null;
  const lookupResult =
    !invalidLink && !settling && link !== null
      ? describeLookup(lookup.isError ? undefined : info)
      : null;
  const prefilled = !!prefill && !selectedToUpdate && formData.link === prefill.link;

  return (
    <Box
      component={"form"}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        width: "100%",
        flexDirection: "column",
      }}
      onSubmit={handleSubmit}
    >
      <Box
        sx={{
          justifyContent: "center",
          width: "100%",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: "1rem",
        }}
      >
        <TextField
          name="link"
          placeholder="Link"
          value={formData.link}
          onChange={handleChange}
          error={invalidLink}
          required
        />
        <TextField
          name="comment"
          type="text"
          placeholder="Kommentar"
          value={formData.comment}
          onChange={handleChange}
        />
        <TextField
          name="name"
          placeholder="Navn (om ikke funnet)"
          value={formData.name}
          onChange={handleChange}
          required={!info?.name}
        />
        <TextField
          name="price"
          type="number"
          placeholder="Pris (om ikke funnet)"
          value={formData.price}
          onChange={handleChange}
          required={info?.price == null}
        />
      </Box>

      <Typography
        variant="caption"
        color={invalidLink ? "error" : "text.secondary"}
        sx={{ textAlign: "center" }}
      >
        {invalidLink
          ? "Ugyldig lenke"
          : settling
          ? "Henter navn og pris…"
          : link === null
          ? "Vi henter navn og pris fra linken. Det du fyller inn under brukes bare hvis vi ikke finner det."
          : lookupResult?.text}
        {lookupResult?.refused && (
          <>
            {" "}
            <Link href={link ?? undefined} target="_blank" rel="noopener noreferrer">
              Åpne siden
            </Link>
          </>
        )}
      </Typography>

      {prefilled && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
          Navn og pris er lest av siden du var på. Sjekk at de stemmer.
        </Typography>
      )}

      <BookmarkletHelp />

      <Button type="submit" disabled={isPending || settling}>
        {isPending
          ? "Lagrer..."
          : settling
          ? "Henter..."
          : selectedToUpdate
          ? "Lagre oppdatering"
          : "Legg til ønske"}
      </Button>

      {showSuccess && <p style={{ color: "green" }}>Ønske lagt til</p>}
      {error && <p className="text-red-600">❌ {error.message}</p>}
    </Box>
  );
}
