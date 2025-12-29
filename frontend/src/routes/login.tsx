import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    setIsLoading(true);
    setError("");

    try {
      // fetch client metadata to get redirect_uri
      const response = await fetch("/client-metadata.json");
      const metadata = await response.json();
      const clientUri = metadata.client_uri;

      // generate nonce
      const nonce = crypto.randomUUID();

      // store nonce for verification
      sessionStorage.setItem("ih_auth_nonce", nonce);

      // build ih-auth URL
      const authUrl = new URL("https://ih-auth.pages.dev/auth");
      authUrl.searchParams.set("redirect_uri", `${clientUri}/oauth/pre`);
      authUrl.searchParams.set("nonce", nonce);

      // redirect to ih-auth
      window.location.assign(authUrl.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to start sign in");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>sign in to aktivi</CardTitle>
          <CardDescription>
            authenticate with your internet handle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              onClick={handleSignIn}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "redirecting..." : "sign in"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
