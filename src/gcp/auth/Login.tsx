import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "./firebase";
import { Button } from "@mui/material";

export default function Login() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  return (
    <div style={{ textAlign: "center", marginTop: "4rem" }}>
      <h2>Sign in to CV Generator</h2>
      <Button
        onClick={handleLogin}
        style={{
          background: "#4285F4",
          color: "white",
          border: "none",
          padding: "0.75rem 1.25rem",
          borderRadius: "0.5rem",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        Sign in with Google
      </Button>
    </div>
  );
}
