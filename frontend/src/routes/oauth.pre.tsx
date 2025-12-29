import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createAuthorizationUrl } from "@atcute/oauth-browser-client";
import { initOAuth } from "../lib/oauth";
import type { ActorIdentifier } from "@atcute/lexicons";

export const Route = createFileRoute("/oauth/pre")({
  component: OAuthPre,
});

function OAuthPre() {
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    // prevent double execution in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const handlePre = async () => {
      try {
        // initialize OAuth configuration
        initOAuth();

        // get hint from query params
        const params = new URLSearchParams(location.search);
        const hint = params.get("hint");
        const nonce = params.get("nonce");

        if (!hint) {
          throw new Error("missing hint parameter");
        }

        if (!nonce) {
          throw new Error("missing nonce parameter");
        }

        // verify nonce
        const storedNonce = sessionStorage.getItem("ih_auth_nonce");
        if (!storedNonce) {
          throw new Error("no nonce found in session storage");
        }

        if (nonce !== storedNonce) {
          throw new Error("nonce mismatch");
        }

        // clean up nonce
        sessionStorage.removeItem("ih_auth_nonce");

        // create authorization URL using hint as identifier
        const authUrl = await createAuthorizationUrl({
          target: { type: "account", identifier: hint as ActorIdentifier },
          scope: "atproto transition:generic",
        });

        // redirect to authorization
        window.location.assign(authUrl);
      } catch (err) {
        console.error("oauth pre failed:", err);
        setError(err instanceof Error ? err.message : "authorization failed");
      }
    };

    handlePre();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">authorization failed</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <a href="/login" className="text-primary hover:underline">
            try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">processing authentication...</p>
      </div>
    </div>
  );
}
