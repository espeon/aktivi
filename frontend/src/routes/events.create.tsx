import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/events/create")({
  component: CreateEventPage,
});

function CreateEventPage() {
  return (
    <div className="min-h-screen h-full min-w-full flex flex-col items-center bg-background px-4">
      <div className="container py-12 max-w-4xl">
        <Link
          to="/events"
          className="mb-8 flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft size={20} />
          back to events
        </Link>

        <div className="mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            create an event
          </h1>
          <p className="text-xl text-muted-foreground">
            share something happening in the Atmosphere
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <form className="space-y-8">
            {/* event name */}
            <div className="space-y-2">
              <Label htmlFor="name">event name</Label>
              <Input id="name" type="text" placeholder="what's happening?" />
            </div>

            {/* description */}
            <div className="space-y-2">
              <Label htmlFor="description">description</Label>
              <Textarea
                id="description"
                placeholder="tell us more about it..."
                rows={4}
              />
            </div>

            {/* starts at */}
            <div className="space-y-2">
              <Label htmlFor="startsAt">when does it start?</Label>
              <Input id="startsAt" type="datetime-local" />
            </div>

            {/* submit button */}
            <Button className="w-full">create event</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
