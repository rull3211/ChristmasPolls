import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDoc, doc, setDoc } from "firebase/firestore";
import Login from "./gcp/auth/Login";
import { useAuth } from "./hooks/useAuth";
import LoggedInApp from "./LoggedInUser";
import { db } from "./gcp/auth/firebase";
import { useSystemDarkMode } from "./hooks/useDarkmode";
import { ThemeProvider } from "@emotion/react";
import { lightTheme } from "./themes/lightMode";
import { darkTheme } from "./themes/darkMode";
import { CssBaseline } from "@mui/material";

function App() {
  const queryClient = new QueryClient();
  const [initLoading, setInitLoading] = useState(true);
  const darkMode = useSystemDarkMode();
  function AuthWrapper() {
    const { user, loading } = useAuth();

    // ✅ First-login Firestore initialization
    useEffect(() => {
      if (!user) return;

      const initializeUser = async () => {
        try {
          const userRef = doc(db, "userProfiles", user.uid);
          const snap = await getDoc(userRef);

          if (!snap.exists()) {
            await setDoc(userRef, {
              name: user.displayName || "Anonymous",
              email: user.email || "",
              createdAt: new Date(),
              role: "user",
            });
            console.log("✅ User doc created on first login");
          }
        } catch (err) {
          console.error("Error initializing user:", err);
        } finally {
          setInitLoading(false);
        }
      };

      initializeUser();
    }, [user]);
    if (!user) return <Login />;
    if (loading || initLoading) return <div>Loading...</div>;

    return <LoggedInApp user={user} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        <AuthWrapper />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
