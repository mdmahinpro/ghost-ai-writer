import { useState } from "react";
import { Button, Card, Field, fieldClass } from "@/components/ui";
import { unlockVault } from "@/lib/vault";

export function UnlockGate() {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6 text-fg">
      <Card className="w-full max-w-md p-6">
        <h1 className="font-display text-3xl">Unlock the studio</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The saved workspace is encrypted. This browser keeps a salt and a check, not the passphrase.
        </p>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (pass.length < 8 || busy) return;
            setBusy(true);
            setError("");
            void unlockVault(pass).then((message) => {
              setBusy(false);
              if (message) setError(message);
            });
          }}
        >
          <Field label="Passphrase">
            <input
              className={fieldClass}
              type="password"
              autoFocus
              value={pass}
              onChange={(event) => setPass(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="current-password"
            />
          </Field>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <Button className="mt-3" type="submit" disabled={busy || pass.length < 8}>
            {busy ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
