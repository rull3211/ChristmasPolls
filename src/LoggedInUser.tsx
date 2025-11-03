import { useState } from "react";
import { AddWish } from "./features/addWish/AddWish";
import { Wishes } from "./features/wishes/Wishes";
import { useQuery } from "@tanstack/react-query";
import { fetchUserProfiles } from "./gcp/firestoreFunctions/fetchUsers";
import type { User } from "firebase/auth";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import Nav from "./features/nav/Nav";
import type { Wish } from "./gcp/firestoreFunctions/AddWishApi";

export default function LoggedInApp({ user }: { user: User }) {
  const [selectedUser, selectUser] = useState(user.uid);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUserProfiles,
  });
  const [selectedWish, selectWish] = useState<Wish | null>(null);
  const handleSelect = (wish: Wish | null) => {
    selectWish(wish);
  };
  if (isLoading)
    return (
      <Box
        sx={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <AppBar position="static">
        <Toolbar
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
            }}
          >
            🎄 Juleønsker
          </Typography>

          <Nav users={users} selectUser={selectUser} selected={selectedUser} />
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Box sx={{ flexGrow: 1, p: 2 }}>
        <Wishes
          userId={selectedUser}
          navn={users.find((el) => el.id === selectedUser)?.name || ""}
          handleSelect={handleSelect}
          selected={selectedWish}
        />
        {user.uid === selectedUser && (
          <AddWish
            handleUpdateSelect={handleSelect}
            selectedToUpdate={selectedWish}
          />
        )}
      </Box>
    </Box>
  );
}
