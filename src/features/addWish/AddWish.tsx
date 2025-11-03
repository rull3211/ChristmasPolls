import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addWish,
  patchWish,
  type Wish,
} from "../../gcp/firestoreFunctions/AddWishApi";
import { useAuth } from "../../hooks/useAuth";
import { Box, Button, TextField, useMediaQuery, useTheme } from "@mui/material";

export function AddWish({
  selectedToUpdate,
  handleUpdateSelect,
}: {
  selectedToUpdate: Wish | null;
  handleUpdateSelect: (wish: Wish | null) => void;
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [formData, setFormData] = useState<Wish>(
    selectedToUpdate || {
      name: "",
      link: "",
      price: "",
      comment: "",
    }
  );

  const { mutate, isPending, error } = useMutation({
    mutationFn: addWish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishes", user?.uid] });
      setFormData({ name: "", link: "", price: "", comment: "" }); // reset form
      setShowSuccess(true); // show message
    },
  });
  const { mutate: update } = useMutation({
    mutationFn: patchWish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishes", user?.uid] });
      setFormData({ name: "", link: "", price: "", comment: "" }); // reset form
      setShowSuccess(true); // show message
    },
  });
  useEffect(() => {
    setFormData(
      selectedToUpdate || { name: "", link: "", price: "", comment: "" }
    );
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
    if (selectedToUpdate) {
      handleUpdateSelect(null);
      update(formData);
    } else mutate(formData);
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
          name="name"
          placeholder="Navn på tingen"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <TextField
          name="link"
          placeholder="Link"
          value={formData.link}
          onChange={handleChange}
          required
        />
        <TextField
          name="price"
          type="number"
          placeholder="Pris"
          value={formData.price}
          onChange={handleChange}
          required
        />{" "}
        <TextField
          name="comment"
          type="text"
          placeholder="Kommentar"
          value={formData.comment}
          onChange={handleChange}
        />
      </Box>

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
