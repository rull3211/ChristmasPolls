import { useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { bookmarkletHref } from "./bookmarklet";

const href = bookmarkletHref(window.location.origin);

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {number}. {title}
      </Typography>
      {children}
    </Box>
  );
}

export function BookmarkletHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(href);
    setCopied(true);
  };

  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        Fyll ut fra nettleseren
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Hent navn og pris fra butikken</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 3 }}>
          <Typography>
            Bruk dette når butikken, for eksempel Elkjøp, Komplett eller
            Zalando, ikke lar oss hente pris automatisk.
          </Typography>

          <Step number={1} title="Lag et bokmerke (bare én gang)">
            <Typography>
              Dra den blå knappen opp til bokmerkelinjen øverst i nettleseren.
              Vis linjen med Cmd+Shift+B på Mac eller Ctrl+Shift+B på PC.
            </Typography>
            <Box>
              {/* React blocks javascript: URLs as props, so the href is set on the element. */}
              <Button
                variant="contained"
                component="a"
                draggable
                ref={(element: HTMLAnchorElement | null) =>
                  element?.setAttribute("href", href)
                }
                onClick={(event: React.MouseEvent) => event.preventDefault()}
              >
                Legg til i Juleønsker
              </Button>
            </Box>
          </Step>

          <Step number={2} title="Åpne produktet i butikken">
            <Typography>
              Gå til produktsiden og vent til prisen vises. Klikk så på
              bokmerket «Legg til i Juleønsker» i bokmerkelinjen. Ikke knappen
              her.
            </Typography>
          </Step>

          <Step number={3} title="Sjekk og lagre">
            <Typography>
              Appen åpnes med link, navn og pris utfylt. Sjekk at det stemmer og
              trykk «Legg til ønske».
            </Typography>
          </Step>

          <Typography variant="body2" color="text.secondary">
            Bokmerket åpner adressen du lagde det fra. Gjør det ingenting på en
            side, blokkerer siden bokmerker, og da fyller du ut for hånd. På
            mobil må du lage bokmerket selv og lime inn koden (Kopier kode)
            som adresse.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={copy}>{copied ? "Kopiert" : "Kopier kode"}</Button>
          <Button onClick={() => setOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
