import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const { signIn, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await signIn(handle);
      // OAuth will redirect, so we might not reach here
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to sign in");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>sign in to aktivi</CardTitle>
          <CardDescription>
            enter your bluesky handle to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="handle">bluesky handle</Label>
              <Input
                id="handle"
                type="text"
                placeholder="username.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "connecting..." : "continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
