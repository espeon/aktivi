import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, CircleAlert, Plus, User, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQt } from "../lib/qt";
import type { EventView } from "../lex/types/co/aktivi/event/defs";
import { isXRPCErrorPayload } from "@atcute/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { OOTBModal } from "@/components/ootb-modal";
import { useState, useEffect } from "react";
import type { Did } from "@atcute/lexicons";
import Throbber from "@/components/ui/throbber";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

function EventsPage() {
  const qt = useQt();
  const queryClient = useQueryClient();
  const [showOOTB, setShowOOTB] = useState(false);

  console.log("EventsPage - qt.did:", qt.did, "qt.isLoggedIn:", qt.isLoggedIn);

  const { data: ootbData } = useQuery({
    queryKey: ["ootb", qt.did],
    queryFn: async () => {
      console.log("fetching ootb data for did:", qt.did);
      if (!qt.did) return null;

      try {
        const response = await qt.client.get("com.atproto.repo.getRecord", {
          params: {
            repo: qt.did as Did,
            collection: "co.aktivi.meta.ootb",
            rkey: "self",
          },
        });
        if (isXRPCErrorPayload(response.data)) {
          throw response.data.error;
        }
        return response.data.value;
      } catch (error) {
        return null;
      }
    },
    enabled: !!qt.did,
  });

  const completeOOTB = useMutation({
    mutationFn: async () => {
      if (!qt.did) return;

      await qt.client.post("com.atproto.repo.putRecord", {
        input: {
          repo: qt.did as Did,
          collection: "co.aktivi.meta.ootb",
          rkey: "self",
          record: {
            ootbComplete: true,
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ootb"] });
      setShowOOTB(false);
    },
  });

  useEffect(() => {
    if (qt.isLoggedIn && (ootbData === null || !ootbData?.ootbComplete)) {
      setShowOOTB(true);
    } else {
      setShowOOTB(false);
    }
  }, [ootbData, qt.isLoggedIn]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await qt.client.get("co.aktivi.event.getEvents", {
        params: {
          limit: 50,
          timezoneOffset: -new Date().getTimezoneOffset(), // convert to minutes from UTC
        },
      });
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen h-screen min-w-full flex items-center justify-center bg-background">
        <Throbber />
      </div>
    );
  }

  if (error) {
    console.error("failed to load events:", error);
    return (
      <div className="min-h-screen h-screen min-w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <CircleAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <div className="text-lg text-destructive">
            failed to load events, could not reach service
          </div>
          <div className="text-sm text-muted-foreground">{String(error)}</div>
        </div>
      </div>
    );
  }
  // if xrpc error payload
  if (isXRPCErrorPayload(data)) {
    return (
      <div className="min-h-screen h-screen min-w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg text-destructive">
            failed to load events, service issue
          </div>
          <div className="text-sm text-muted-foreground">
            {(data as any).error.message || "unknown error"}
          </div>
        </div>
      </div>
    );
  }

  const eventsByDate = data?.eventsByDate || [];

  return (
    <>
      {showOOTB && (
        <OOTBModal
          onClose={() => setShowOOTB(false)}
          onComplete={() => completeOOTB.mutate()}
        />
      )}
      <div className="min-h-screen h-full min-w-full flex flex-col items-center bg-background px-4">
        <div className="container py-12 max-w-4xl">
          <div className="mb-12 flex items-start justify-between">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold mb-4">events</h1>
              <p className="text-xl text-muted-foreground">
                discover happenings and activities around the Atmosphere
              </p>
            </div>
            {qt.isLoggedIn && (
              <Link to="/events/create">
                <Button size="icon" className="rounded-full h-12 w-12">
                  <Plus size={24} />
                </Button>
              </Link>
            )}
          </div>

          {/* timeline */}
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-1 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-12">
              {eventsByDate.map((day, dayIndex) => (
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

                              {/* host */}
                              <div className="flex items-center gap-2 text-sm">
                                <Avatar>
                                  <AvatarImage src={event.author.avatar} />
                                  <AvatarFallback>
                                    <User />
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">
                                  {event.author.displayName
                                    ? `${event.author.displayName} (${event.author.handle || event.author.did})`
                                    : event.author.handle || event.author.did}
                                </span>
                              </div>

                              {/* description */}
                              {record.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {record.description}
                                </p>
                              )}
                            </div>

                            {/* event placeholder */}
                            <div className="relative h-48 md:max-h-min m-2 rounded-lg border aspect-square bg-gradient-to-br from-primary/20 via-primary/10 to-muted/30 flex items-center justify-center">
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
                events from around the Atmosphere will appear here, once there
                are any.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
