import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuth } from "firebase/auth";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { fetchWishes } from "../../gcp/firestoreFunctions/fetchWishes";
import { deleteWish } from "../../gcp/firestoreFunctions/deleteWish";
import { refreshWishes } from "../../gcp/firestoreFunctions/refreshWishes";
import { saveWishOrder } from "../../gcp/firestoreFunctions/saveWishOrder";
import { Box, List, Typography } from "@mui/material";
import { SortableWishRow, WishRow, type WishRowProps } from "./components/WishRow";
import type { StoredWish, Wish } from "../../gcp/firestoreFunctions/AddWishApi";
import { needsRefresh, pendingRefreshKeys } from "./wishFreshness";
import { applyOrder, isRanked, moveId } from "./wishOrder";

// Every list is a priority list. Until the owner has dragged anything, the
// order is only alphabetical, and the hint says so.
function priorityHint(isOwner: boolean, ranked: boolean, firstName: string): string {
  if (isOwner) {
    return ranked
      ? "Din prioriterte liste: det du ønsker deg mest står øverst. Dra i håndtaket for å endre rekkefølgen."
      : "Dette er en prioritert liste: det du ønsker deg mest skal stå øverst. Dra i håndtaket for å sette rekkefølgen.";
  }
  return ranked
    ? "Prioritert liste: det som ønskes mest står øverst."
    : `Prioritert liste, men ${firstName} har ikke satt rekkefølgen ennå.`;
}

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
  const isOwner = currentUser?.uid === userId;
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

  const { mutate: refresh, isPending: refreshing } = useMutation({
    mutationFn: () => refreshWishes(userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["wishes", userId] }),
  });
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (refreshing) return;
    const due = pendingRefreshKeys(wishes, attempted.current);
    if (due.length === 0) return;
    due.forEach((key) => attempted.current.add(key));
    refresh();
  }, [wishes, refreshing, refresh]);

  // The list moves at once and is rolled back if saving fails.
  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => saveWishOrder(userId, orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ["wishes", userId] });
      const previous = queryClient.getQueryData<StoredWish[]>(["wishes", userId]);
      queryClient.setQueryData<StoredWish[]>(["wishes", userId], (current = []) =>
        applyOrder(current, orderedIds)
      );
      return { previous };
    },
    onError: (_error, _orderedIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["wishes", userId], context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["wishes", userId] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    reorder.mutate(
      moveId(
        wishes.map((wish) => wish.id),
        String(active.id),
        String(over.id)
      )
    );
  };

  if (isLoading) return <Typography>Laster</Typography>;
  if (error)
    return (
      <Typography>En feil har skjedd: {(error as Error).message}</Typography>
    );

  const ranked = isRanked(wishes);
  const hint = wishes.length
    ? priorityHint(isOwner, ranked, navn.split(" ")[0])
    : null;
  const rows = wishes.map((wish, index) => {
    const props: WishRowProps = {
      wish,
      rank: index + 1,
      fetching: refreshing && needsRefresh(wish),
      isOwner,
      selected,
      onSelect: handleSelect,
      deletingId,
      onDelete: deleteMutation.mutate,
    };
    return isOwner ? (
      <SortableWishRow key={wish.id} {...props} />
    ) : (
      <WishRow key={wish.id} {...props} />
    );
  });

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
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: "center", maxWidth: "32rem" }}
        >
          {hint}
        </Typography>
      )}
      {reorder.isError && (
        <Typography variant="caption" color="error">
          Kunne ikke lagre rekkefølgen. Prøv igjen.
        </Typography>
      )}

      {!!wishes.length && (
        <List className="space-y-2">
          {isOwner ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={wishes.map((wish) => wish.id)}
                strategy={verticalListSortingStrategy}
              >
                {rows}
              </SortableContext>
            </DndContext>
          ) : (
            rows
          )}
        </List>
      )}
    </Box>
  );
}
