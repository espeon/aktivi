import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useQt } from "../lib/qt";
import type { EventView } from "../lex/types/co/aktivi/event/defs";
import { isXRPCErrorPayload } from "@atcute/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Handle } from "@atcute/lexicons";
import Throbber from "@/components/ui/throbber";

export const Route = createFileRoute("/user/$handle")({
  component: UserPage,
});

function UserPage() {
  const { handle } = Route.useParams();
  const qt = useQt();

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ["profile", handle],
    queryFn: async () => {
      const response = await qt.client.get("co.aktivi.actor.getProfileView", {
        params: { actor: handle as Handle },
      });
      if (isXRPCErrorPayload(response.data)) {
        throw response.data.error;
      }
      return response.data.profile;
    },
  });

  const { data: timelineData, isLoading: _timelineLoading } = useQuery({
    queryKey: ["user-timeline", handle],
    queryFn: async () => {
      const response = await qt.client.get("co.aktivi.actor.getTimeline", {
        params: {
          actor: handle,
          limit: 50,
          timezoneOffset: -new Date().getTimezoneOffset(),
        },
      });
      if (isXRPCErrorPayload(response.data)) {
        throw response.data.error;
      }
      return response.data;
    },
    enabled: !!profile,
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen h-screen min-w-full flex items-center justify-center bg-background">
        <Throbber />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen h-screen min-w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <CircleAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <div className="text-lg text-destructive">failed to load profile</div>
          <div className="text-sm text-muted-foreground">
            {String(profileError)}
          </div>
        </div>
      </div>
    );
  }

  const eventsByDate = timelineData?.eventsByDate || [];

  return (
    <div className="min-h-screen h-full min-w-full flex flex-col items-center bg-background px-4">
      <div className="container py-12 max-w-4xl">
        {/* profile header */}
        <div className="mb-12 flex flex-col md:flex-row gap-8 items-start">
          <Avatar className="h-32 w-32 shrink-0">
            <AvatarImage src={profile?.avatar} />
            <AvatarFallback className="text-4xl">
              {profile?.displayName?.[0] || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-2">
                {profile?.displayName || "user"}
              </h1>
              <div className="text-xl text-muted-foreground">
                {profile?.handle || handle}
              </div>
            </div>

            {profile?.description && (
              <p className="text-lg text-foreground/80 max-w-2xl">
                {profile.description}
              </p>
            )}
          </div>
        </div>

        {/* timeline section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-6">timeline</h2>
        </div>

        {/* timeline */}
        <div className="relative">
          {/* vertical line */}
          {eventsByDate.length > 0 && (
            <div className="absolute left-1 top-0 bottom-0 w-px bg-border" />
          )}

          <div className="space-y-12">
            {eventsByDate.map((day: any, dayIndex: number) => (
              <div key={dayIndex} className="relative">
                {/* date header with dot */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-2 h-2 rounded-full shrink-0 relative z-10 bg-accent ring-4 ring-accent transition-colors" />
                  <div className="text-lg">
                    <span className="font-bold">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "long",
                      })}
                    </span>
                  </div>
                </div>

                {/* events for this day */}
                <div className="ml-6 space-y-6">
                  {day.events.map((event: EventView) => {
                    const record = event.record as any;
                    const startsAt = record.startsAt
                      ? new Date(record.startsAt)
                      : null;

                    return (
                      <div
                        key={event.uri}
                        className="bg-card border-2 border-border rounded-2xl overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer"
                      >
                        <div className="flex flex-col-reverse md:flex md:flex-row gap-0 justify-between">
                          {/* event info */}
                          <div className="p-6 space-y-3">
                            {/* time */}
                            {startsAt && (
                              <div className="text-base font-medium text-muted-foreground">
                                {startsAt.toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}

                            {/* title */}
                            <h3 className="text-2xl font-bold leading-tight">
                              {record.name}
                            </h3>

                            {/* description */}
                            {record.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {record.description}
                              </p>
                            )}
                          </div>

                          {/* event placeholder */}
                          <div className="relative h-48 md:max-h-min m-2 rounded-lg border aspect-square bg-linear-to-br from-primary/20 via-primary/10 to-muted/30 flex items-center justify-center">
                            <div className="text-2xl font-bold text-primary/30 text-center leading-tight">
                              {record.name
                                .split(" ")
                                .slice(0, 3)
                                .join("\n")
                                .toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* empty state */}
        {eventsByDate.length === 0 && (
          <div className="text-center py-24">
            <Calendar className="h-24 w-24 text-muted-foreground mx-auto mb-6 opacity-20" />
            <h2 className="text-2xl font-bold mb-2">no events yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              events from this user will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
