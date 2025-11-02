import { useState } from "react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import type { User } from "../../types/User";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  users: User[];
  selectUser: (id: string) => void;
  selected: string;
}

export default function Nav({ users, selectUser, selected }: Props) {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (id: string) => {
    selectUser(id);
    if (isMobile) setDrawerOpen(false); // close drawer on mobile
  };

  // User buttons
  const userButtons = users.map((el) => (
    <Button
      key={el.id}
      sx={{
        borderBottom:
          selected === el.id
            ? `3px solid ${theme.palette.primary.contrastText}` // contrast text for border
            : "none",
        borderRadius: 0,
        justifyContent: "flex-start",
        width: "100%",
        textTransform: "none",
        color: theme.palette.primary.contrastText, // ensures button text is readable
        "&:hover": {
          backgroundColor: theme.palette.primary.light,
          color: theme.palette.primary.contrastText,
        },
      }}
      onClick={() => handleSelect(el.id)}
    >
      {el.name.split(" ")[0]}
    </Button>
  ));

  // Extra menu buttons
  const extraButtons = [
    {
      label: "Mine ønsker",
      onClick: () => {
        if (user) handleSelect(user.uid);
      },
    }, // your handler here
    {
      label: "Legg til Ønske",
      onClick: () => {
        if (user) handleSelect(user.uid);
      },
    }, // your handler here
  ].map((item) => (
    <Button
      key={item.label}
      sx={{
        borderRadius: 0,
        justifyContent: "flex-start",
        width: "100%",
        textTransform: "none",
        color: theme.palette.primary.contrastText,
        "&:hover": {
          backgroundColor: theme.palette.primary.light,
          color: theme.palette.primary.contrastText,
        },
      }}
      onClick={item.onClick}
    >
      {item.label}
    </Button>
  ));

  const allButtons = [...userButtons, ...extraButtons];

  if (isMobile) {
    return (
      <>
        <IconButton onClick={() => setDrawerOpen(true)}>
          <MenuIcon />
        </IconButton>
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <Box sx={{ width: 250, p: 2 }}>
            <List>
              {allButtons.map((btn) => (
                <ListItem key={btn.key || btn.props.children} disablePadding>
                  <ListItemButton onClick={btn.props.onClick}>
                    {btn.props.children}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </Drawer>
      </>
    );
  }

  // Desktop: horizontal nav
  return <Box sx={{ display: "flex", gap: 1 }}>{allButtons}</Box>;
}
