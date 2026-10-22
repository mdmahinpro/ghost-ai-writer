import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useApp, useHydrated } from "@/lib/store";
import { Button, Card } from "@/components/ui";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const hydrated = useHydrated();
  const patchAccount = useApp((s) => s.patchAccount);
  const [result, setResult] = useState<"wait" | "ok" | "bad" | "expired">("wait");

  useEffect(() => {
    if (!hydrated) return;
    const account = useApp.getState().account;
    if (!token || token !== account.emailVerifyToken) {
      setResult("bad");
      return;
    }
    if (!account.emailVerifyExpires || account.emailVerifyExpires < Date.now()) {
      setResult("expired");
      return;
    }
    patchAccount({ emailVerified: true, emailVerifyToken: "", emailVerifyExpires: 0 });
    setResult("ok");
  }, [hydrated, token, patchAccount]);

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card className="p-6">
        <h1 className="font-display text-3xl">Email verification</h1>
        {result === "wait" ? <p className="mt-3 text-sm text-muted">Checking the link…</p> : null}
        {result === "ok" ? <p className="mt-3 text-sm text-ok">This email is verified. The link matched the token that was sent.</p> : null}
        {result === "bad" ? <p className="mt-3 text-sm text-danger">This link does not match a verification token on this browser. The email was not marked verified.</p> : null}
        {result === "expired" ? <p className="mt-3 text-sm text-danger">This link has expired. Send a new one from Account. The email was not marked verified.</p> : null}
        <Link to="/account" className="mt-4 inline-flex">
          <Button variant="ghost">Back to account</Button>
        </Link>
      </Card>
    </div>
  );
}
