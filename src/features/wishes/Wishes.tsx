import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuth } from "firebase/auth";
import { fetchWishes } from "../../gcp/firestoreFunctions/fetchWishes";
import { deleteWish } from "../../gcp/firestoreFunctions/deleteWish";
import { Box, Link, List, ListItem, Typography } from "@mui/material";
import DeleteWish from "./components/DeleteWish";

export function Wishes({ userId, navn }: { userId: string; navn: string }) {
  const queryClient = useQueryClient();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const {
    data: wishes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["wishes", userId],
    queryFn: () => fetchWishes(userId),
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: (wishId: string) => deleteWish(userId, wishId),
    onMutate: (wishId) => {
      setDeletingId(wishId);
    },
    onSettled: () => {
      setDeletingId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishes", userId] });
    },
  });
  deleteMutation.mutate;

  if (isLoading) return <Typography>Laster</Typography>;
  if (error)
    return (
      <Typography>En feil har skjedd: {(error as Error).message}</Typography>
    );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        marginBlock: "2rem",
        flexDirection: "column",
      }}
    >
      <Typography>
        {navn.split(" ")[0]}{" "}
        {wishes.length ? "sine ønsker." : "har ingen ønsker enda"}
      </Typography>

      {!!wishes.length && (
        <List className="space-y-2">
          {wishes.map((wish: any) => (
            <ListItem
              sx={{ gap: "1rem" }}
              key={wish.id}
              className="border rounded-lg p-3 flex justify-between items-center"
            >
              <Box>
                <Link
                  href={wish.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                >
                  <Typography>
                    {wish.name} — {wish.price}kr
                  </Typography>
                </Link>
              </Box>

              {currentUser?.uid === userId && (
                <DeleteWish
                  id={wish.id}
                  deletingId={deletingId}
                  deleteWish={deleteMutation.mutate}
                />
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
