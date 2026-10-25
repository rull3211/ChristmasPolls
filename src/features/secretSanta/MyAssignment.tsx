import { useQuery } from "@tanstack/react-query";
import { Alert, Typography } from "@mui/material";
import { fetchMyAssignment } from "../../gcp/firestoreFunctions/secretSanta";
import type { User } from "../../types/User";
import { formatTimestamp } from "./formatTimestamp";

export default function MyAssignment({
  userId,
  users,
}: {
  userId: string;
  users: User[];
}) {
  const { data: assignment } = useQuery({
    queryKey: ["secretSanta", "assignment", userId],
    queryFn: () => fetchMyAssignment(userId),
  });

  if (!assignment) return null;

  const receiver = users.find((u) => u.id === assignment.receiverId);

  return (
    <Alert icon={<span>🎅</span>} severity="success" sx={{ mb: 2 }}>
      <Typography>
        Du er secret santa til: <strong>{receiver?.name ?? "ukjent"}</strong>
      </Typography>
      <Typography variant="caption">
        Trukket {formatTimestamp(assignment.announcedAt)}
      </Typography>
    </Alert>
  );
}
