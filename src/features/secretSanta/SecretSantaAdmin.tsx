import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  fetchActiveDraw,
  fetchDraws,
  rollbackToDraw,
  startDraw,
  type DrawSummary,
} from "../../gcp/firestoreFunctions/secretSanta";
import type { User } from "../../types/User";
import { formatTimestamp } from "./formatTimestamp";

type PendingAction = { kind: "draw" } | { kind: "rollback"; draw: DrawSummary };

function findCouples(users: User[]): [User, User][] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const seen = new Set<string>();
  const couples: [User, User][] = [];
  for (const user of users) {
    const spouse = user.spouseId ? byId.get(user.spouseId) : undefined;
    if (!spouse) continue;
    const key = [user.id, spouse.id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    couples.push([user, spouse]);
  }
  return couples;
}

export default function SecretSantaAdmin({
  adminId,
  users,
}: {
  adminId: string;
  users: User[];
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingAction | null>(null);

  const { data: active, isLoading: activeLoading } = useQuery({
    queryKey: ["secretSanta", "active"],
    queryFn: fetchActiveDraw,
  });
  const { data: draws = [], isLoading: drawsLoading } = useQuery({
    queryKey: ["secretSanta", "draws"],
    queryFn: fetchDraws,
  });

  const mutation = useMutation({
    mutationFn: (action: PendingAction) =>
      action.kind === "draw"
        ? startDraw(adminId)
        : rollbackToDraw(action.draw, adminId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["secretSanta"] }),
    onSettled: () => setPending(null),
  });

  if (activeLoading || drawsLoading) return <CircularProgress />;

  const couples = findCouples(users);
  const paired = new Set(couples.flat().map((u) => u.id));
  const unpaired = users.filter((u) => !paired.has(u.id));

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", display: "grid", gap: 2 }}>
      <Typography variant="h5">Secret Santa-trekning</Typography>

      <Box>
        <Typography variant="subtitle2">
          Disse kan ikke trekke hverandre
        </Typography>
        {couples.map(([a, b]) => (
          <Typography key={a.id}>
            {a.name} ↔ {b.name}
          </Typography>
        ))}
      </Box>

      {unpaired.length > 0 && (
        <Alert severity="info">
          Uten registrert partner: {unpaired.map((u) => u.name).join(", ")}
        </Alert>
      )}

      <Typography>
        {active
          ? `Aktiv trekning: ${formatTimestamp(active.announcedAt)}`
          : "Ingen trekning er gjort enda."}
      </Typography>

      <Box>
        <Button
          variant="contained"
          color={active ? "error" : "primary"}
          disabled={mutation.isPending}
          onClick={() => setPending({ kind: "draw" })}
        >
          {active ? "Trekk på nytt" : "Start trekning"}
        </Button>
      </Box>

      {mutation.error && (
        <Alert severity="error">{(mutation.error as Error).message}</Alert>
      )}

      {draws.length > 0 && (
        <Box>
          <Typography variant="subtitle2">
            Alle trekninger (backup)
          </Typography>
          <List>
            {draws.map((draw) => (
              <ListItem
                key={draw.id}
                disableGutters
                secondaryAction={
                  draw.id === active?.activeDrawId ? (
                    <Chip label="Aktiv" color="success" size="small" />
                  ) : (
                    <Button
                      disabled={mutation.isPending}
                      onClick={() => setPending({ kind: "rollback", draw })}
                    >
                      Rull tilbake
                    </Button>
                  )
                }
              >
                <ListItemText
                  primary={formatTimestamp(draw.createdAt)}
                  secondary={`${draw.participantCount} deltakere`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <Dialog
        open={pending !== null}
        onClose={() => !mutation.isPending && setPending(null)}
      >
        <DialogTitle>
          {pending?.kind === "rollback"
            ? "Rulle tilbake?"
            : active
            ? "Trekke på nytt?"
            : "Start trekning?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pending?.kind === "rollback"
              ? `Alle får tilbake mottakeren fra trekningen ${formatTimestamp(
                  pending.draw.createdAt
                )}. Den nåværende trekningen blir liggende som backup.`
              : active
              ? `Det finnes allerede en trekning fra ${formatTimestamp(
                  active.announcedAt
                )}. Hvis du trekker på nytt, får alle en ny mottaker. Den gamle trekningen lagres som backup, og du kan rulle tilbake til den.`
              : "Alle får tildelt en mottaker og ser den med en gang. Ingen kan trekke seg selv eller partneren sin."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={mutation.isPending}
            onClick={() => setPending(null)}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            color={pending?.kind === "rollback" || !active ? "primary" : "error"}
            disabled={mutation.isPending}
            onClick={() => pending && mutation.mutate(pending)}
          >
            {mutation.isPending
              ? "Lagrer..."
              : pending?.kind === "rollback"
              ? "Rull tilbake"
              : active
              ? "Trekk på nytt"
              : "Start trekning"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
