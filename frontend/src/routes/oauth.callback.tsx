import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQt } from "../lib/qt";

export const Route = createFileRoute("/oauth/callback")({
  component: OAuthCallback,
});

function OAuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qt = useQt();
  const hasRun = useRef(false);

  useEffect(() => {
    // prevent double execution in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        // server redirects with params in hash, not search string
        const params = new URLSearchParams(location.hash.slice(1));

        // scrub params from URL to prevent replay
        history.replaceState(null, "", location.pathname + location.search);

        // finalize authorization using Qt provider
        await qt.finalizeAuth(params);

        // redirect to home
        navigate({ to: "/" });
      } catch (err) {
        console.error("oauth callback failed:", err);
        setError(err instanceof Error ? err.message : "authorization failed");
      }
    };

    handleCallback();
  }, [navigate, qt]);

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
        <p className="text-muted-foreground">completing sign in...</p>
      </div>
    </div>
  );
}
