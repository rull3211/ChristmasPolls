import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addWish,
  patchWish,
  type StoredWish,
  type Wish,
} from "../../gcp/firestoreFunctions/AddWishApi";
import { useAuth } from "../../hooks/useAuth";
import { placeAtEnd } from "../wishes/wishOrder";
import { BookmarkletHelp } from "../bookmarklet/BookmarkletHelp";
import { normalizeLink } from "./normalizeLink";
import type { Prefill } from "./prefill";
import {
  Box,
  Button,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

const EMPTY_WISH: Wish = { name: "", link: "", price: "", comment: "" };

function wishFromPrefill(prefill: Prefill | null | undefined): Wish | null {
  return prefill
    ? { ...EMPTY_WISH, link: prefill.link, name: prefill.name, price: prefill.price }
    : null;
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

  const { mutate, isPending, error } = useMutation({
    mutationFn: ({ wish, rankExisting }: { wish: Wish; rankExisting: string[] }) =>
      addWish(wish, rankExisting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishes", user?.uid] });
      setFormData(EMPTY_WISH); // reset form
      setShowSuccess(true); // show message
      onPrefillUsed?.();
    },
  });
  const { mutate: update } = useMutation({
    mutationFn: ({ wish, clearFetched }: { wish: Wish; clearFetched: boolean }) =>
      patchWish(wish, clearFetched),
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

  const link = normalizeLink(formData.link);
  const invalidLink = formData.link.trim() !== "" && link === null;
  const prefilled = !!prefill && !selectedToUpdate && formData.link === prefill.link;

  // Saving never waits for a lookup: the list fetches name and price in the
  // background once the wish is there.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (link === null) return;

    const wish: Wish = { ...formData, link };
    if (selectedToUpdate) {
      const clearFetched = normalizeLink(selectedToUpdate.link) !== link;
      handleUpdateSelect(null);
      update({ wish, clearFetched });
    } else {
      const current =
        queryClient.getQueryData<StoredWish[]>(["wishes", user?.uid]) ?? [];
      const { order, rankExisting } = placeAtEnd(current);
      mutate({ wish: { ...wish, order }, rankExisting });
    }
  };

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
          required
        />
        <TextField
          name="price"
          type="number"
          placeholder="Pris (om ikke funnet)"
          value={formData.price}
          onChange={handleChange}
          required
        />
      </Box>

      <Typography
        variant="caption"
        color={invalidLink ? "error" : "text.secondary"}
        sx={{ textAlign: "center" }}
      >
        {invalidLink
          ? "Ugyldig lenke"
          : "Ønsket legges til med en gang. Vi henter navn og pris fra linken etterpå, og det du fyller inn her brukes bare hvis vi ikke finner det."}
      </Typography>

      {prefilled && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
          Navn og pris er lest av siden du var på. Sjekk at de stemmer.
        </Typography>
      )}

      <BookmarkletHelp />

      <Button type="submit" disabled={isPending}>
        {isPending
          ? "Lagrer..."
          : selectedToUpdate
          ? "Lagre oppdatering"
          : "Legg til ønske"}
      </Button>

      {showSuccess && <p style={{ color: "green" }}>Ønske lagt til</p>}
      {error && <p className="text-red-600">❌ {error.message}</p>}
    </Box>
  );
}
