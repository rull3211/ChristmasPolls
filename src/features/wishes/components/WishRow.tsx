import type { CSSProperties, ReactNode, Ref } from "react";
import { Box, Button, IconButton, Link, ListItem, Typography } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { UseMutateFunction } from "@tanstack/react-query";
import type { StoredWish, Wish } from "../../../gcp/firestoreFunctions/AddWishApi";
import { displayName, displayPrice, priceFetchedOn, priceIsTyped } from "../displayWish";
import DeleteWish from "./DeleteWish";

export type WishRowProps = {
  wish: StoredWish;
  rank: number;
  fetching: boolean;
  isOwner: boolean;
  selected: Wish | null;
  onSelect: (wish: Wish | null) => void;
  deletingId: string | null;
  onDelete: UseMutateFunction<string, Error, string, void>;
};

type Layout = {
  handle?: ReactNode;
  rootRef?: Ref<HTMLLIElement>;
  rootStyle?: CSSProperties;
};

export function WishRow({
  wish,
  rank,
  fetching,
  isOwner,
  selected,
  onSelect,
  deletingId,
  onDelete,
  handle,
  rootRef,
  rootStyle,
}: WishRowProps & Layout) {
  return (
    <ListItem
      ref={rootRef}
      style={rootStyle}
      sx={{ gap: "1rem" }}
      className="border rounded-lg p-3 flex justify-between items-center"
    >
      {handle}
      <Typography sx={{ fontWeight: 600, minWidth: "1.5rem" }}>
        {rank}.
      </Typography>
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
        {fetching && (
          <Typography variant="caption" color="text.secondary">
            Henter pris…
          </Typography>
        )}
        {priceIsTyped(wish) && !fetching && (
          <Typography variant="caption" color="text.secondary">
            Pris ikke hentet automatisk
          </Typography>
        )}
        {wish.comment && <Typography>Kommentar: {wish.comment}</Typography>}
      </Box>

      {isOwner && (
        <>
          <Button onClick={() => onSelect(selected?.id === wish.id ? null : wish)}>
            {selected ? "Avslutt redigering" : "Rediger"}
          </Button>
          <DeleteWish id={wish.id} deletingId={deletingId} deleteWish={onDelete} />
        </>
      )}
    </ListItem>
  );
}

// Only the handle starts a drag, so links, buttons and scrolling on a phone
// keep working everywhere else on the row.
export function SortableWishRow(props: WishRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.wish.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : "auto",
  };

  return (
    <WishRow
      {...props}
      rootRef={setNodeRef}
      rootStyle={style}
      handle={
        <IconButton
          ref={setActivatorNodeRef}
          aria-label="Dra for å endre rekkefølgen"
          {...attributes}
          {...listeners}
          sx={{ touchAction: "none", cursor: "grab" }}
        >
          <DragIndicatorIcon />
        </IconButton>
      }
    />
  );
}
