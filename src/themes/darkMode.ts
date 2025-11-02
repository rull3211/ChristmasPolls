import { createTheme } from "@mui/material";

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#90caf9",
      contrastText: "#dad8d8ff", // readable on your dark primary background
    },
    secondary: {
      main: "#ce93d8",
      contrastText: "#000",
    },
    background: {
      default: "#121212",
      paper: "#1e1e1e",
    },
  },
});
