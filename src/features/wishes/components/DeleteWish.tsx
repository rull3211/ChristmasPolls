import { Box, Button, Typography } from "@mui/material";
import type { UseMutateFunction } from "@tanstack/react-query";
import { useState } from "react";

export default function DeleteWish({
  id,
  deleteWish,
  deletingId,
}: {
  id: string;
  deletingId: string | null;
  deleteWish: UseMutateFunction<string, Error, string, void>;
}) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm)
    return (
      <Button
        onClick={() => setConfirm(true)}
        disabled={deletingId === id}
        className={`px-3 py-1 rounded text-white transition ${
          deletingId === id
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-red-500 hover:bg-red-600"
        }`}
      >
        Slett ønske
      </Button>
    );
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <Typography>Sikker?</Typography>
      <Box>
        <Button
          onClick={() => deleteWish(id)}
          disabled={deletingId === id}
          className={`px-3 py-1 rounded text-white transition ${
            deletingId === id
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          {deletingId === id ? "Sletter..." : "Ja"}
        </Button>
        <Button
          onClick={() => setConfirm(false)}
          disabled={deletingId === id}
          className={`px-3 py-1 rounded text-white transition ${
            deletingId === id
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600"
          }`}
        >
          Nei
        </Button>
      </Box>
    </Box>
  );
}
