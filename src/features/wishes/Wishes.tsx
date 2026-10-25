import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuth } from "firebase/auth";
import { fetchWishes } from "../../gcp/firestoreFunctions/fetchWishes";
import { deleteWish } from "../../gcp/firestoreFunctions/deleteWish";
import { refreshWishes } from "../../gcp/firestoreFunctions/refreshWishes";
import { Box, Button, Link, List, ListItem, Typography } from "@mui/material";
import DeleteWish from "./components/DeleteWish";
import type { Wish } from "../../gcp/firestoreFunctions/AddWishApi";
import {
  displayName,
  displayPrice,
  priceFetchedOn,
  priceIsTyped,
} from "./displayWish";
import { needsRefresh } from "./wishFreshness";

export function Wishes({
  userId,
  navn,
  handleSelect,
  selected,
}: {
  userId: string;
  navn: string;
  handleSelect: (wish: Wish | null) => void;
  selected: Wish | null;
}) {
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

  const { mutate: refresh, isPending: refreshing } = useMutation({
    mutationFn: () => refreshWishes(userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["wishes", userId] }),
  });
  const requestedFor = useRef(new Set<string>());
  const stale = wishes.some(needsRefresh);
  useEffect(() => {
    if (!stale || requestedFor.current.has(userId)) return;
    requestedFor.current.add(userId);
    refresh();
  }, [stale, userId, refresh]);

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
      {refreshing && (
        <Typography variant="caption" color="text.secondary">
          Oppdaterer priser…
        </Typography>
      )}

      {!!wishes.length && (
        <List className="space-y-2">
          {wishes.map((wish) => (
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
                    {displayName(wish)}
                    {displayPrice(wish) && ` — ${displayPrice(wish)}`}
                  </Typography>
                </Link>
                {priceFetchedOn(wish) && (
                  <Typography variant="caption" color="text.secondary">
                    Pris hentet {priceFetchedOn(wish)}
                  </Typography>
                )}
                {priceIsTyped(wish) && (
                  <Typography variant="caption" color="text.secondary">
                    Pris ikke hentet automatisk
                  </Typography>
                )}
                {wish.comment && (
                  <Typography>Kommentar: {wish.comment}</Typography>
                )}
              </Box>

              {currentUser?.uid === userId && (
                <>
                  <Button
                    onClick={() =>
                      handleSelect(selected?.id === wish.id ? null : wish)
                    }
                  >
                    {selected ? "Avslutt redigering" : "Rediger"}
                  </Button>
                  <DeleteWish
                    id={wish.id}
                    deletingId={deletingId}
                    deleteWish={deleteMutation.mutate}
                  />
                </>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
