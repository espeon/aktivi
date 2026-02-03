import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CircleAlert,
  Calendar,
  MapPin,
  Users,
  ExternalLink,
  ChevronLeft,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { isXRPCErrorPayload, Client, simpleFetchHandler } from "@atcute/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Throbber from "@/components/ui/throbber";
import { useQt } from "@/lib/qt";
import type { EventViewDetailed } from "@/lex/types/co/aktivi/event/defs";
import type { ActorIdentifier, ResourceUri } from "@atcute/lexicons";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/user/$handle/event/$rkey")({
  component: EventPage,
});

const ModeDisplay = {
  "community.lexicon.calendar.event#inperson": "In Person",
  "community.lexicon.calendar.event#online": "Online",
  "community.lexicon.calendar.event#hybrid": "Hybrid",
};

function YesNoMaybe({
  uri,
  cid,
  prevrkey,
  currentStatus,
  currentRsvpUri,
  cancelDir = "start",
}: {
  uri: string;
  cid: string;
  prevrkey?: string;
  currentStatus?: string | null;
  currentRsvpUri?: string | null;
  cancelDir: "start" | "end";
}) {
  console.log(uri);
  const qt = useQt();
  const [isLoading, setIsLoading] = React.useState(false);
  const [rsvpUri, setRsvpUri] = React.useState<string | null>(
    currentRsvpUri || null,
  );

  // Map RSVP status to button state
  const getInitialState = (
    status?: string | null,
  ): "yes" | "maybe" | "no" | null => {
    if (!status) return null;
    if (status.includes("#going")) return "yes";
    if (status.includes("#interested")) return "maybe";
    if (status.includes("#notgoing")) return "no";
    return null;
  };

  const [selected, setSelected] = React.useState<"yes" | "maybe" | "no" | null>(
    getInitialState(currentStatus),
  );

  const submitRsvp = async (status: "yes" | "maybe" | "no") => {
    if (!qt.did) return;

    setIsLoading(true);
    try {
      const rsvpStatus =
        status === "yes"
          ? "community.lexicon.calendar.rsvp#going"
          : status === "maybe"
            ? "community.lexicon.calendar.rsvp#interested"
            : "community.lexicon.calendar.rsvp#notgoing";

      const rkey = prevrkey || `${Date.now()}`;
      try {
        const response = await qt.client.post("com.atproto.repo.putRecord", {
          input: {
            repo: qt.did as ActorIdentifier,
            collection: "community.lexicon.calendar.rsvp",
            rkey,
            record: {
              $type: "community.lexicon.calendar.rsvp",
              subject: { uri, cid },
              status: rsvpStatus,
              createdAt: new Date().toISOString(),
            },
          },
        });
        console.log(response.data);
        setRsvpUri(`at://${qt.did}/community.lexicon.calendar.rsvp/${rkey}`);
        setSelected(status);
      } catch (e) {
        console.error("Error submitting RSVP:", e);
      }
    } catch (error) {
      console.error("Failed to submit RSVP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleYes = () => submitRsvp("yes");
  const handleMaybe = () => submitRsvp("maybe");
  const handleNo = () => submitRsvp("no");

  const handleClear = async () => {
    if (!qt.did || !rsvpUri) return;

    setIsLoading(true);
    try {
      // Parse the rkey from the URI (format: at://did/collection/rkey)
      const uriParts = rsvpUri.split("/");
      const rkey = prevrkey || uriParts[uriParts.length - 1];

      await qt.client.post("com.atproto.repo.deleteRecord", {
        input: {
          repo: qt.did! as ActorIdentifier,
          collection: "community.lexicon.calendar.rsvp",
          rkey,
        },
      });

      setRsvpUri(null);
      setSelected(null);
    } catch (error) {
      console.error("Failed to clear RSVP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 flex-1">
      {cancelDir === "start" &&
        (selected ? (
          <div
            className="rounded-full w-8 h-8 relative z-10 transition-all cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground animate-in fade-in"
            onClick={handleClear}
          >
            <X size={16} />
          </div>
        ) : (
          <X size={16} className="opacity-0 w-8 h-8" />
        ))}
      <div
        className={cn(
          "relative flex bg-muted-foreground/5 rounded-full p-1 gap-1 flex-1",
          isLoading && "opacity-50 pointer-events-none",
        )}
      >
        <div
          className="absolute inset-y-1 bg-foreground rounded-full transition-all duration-300 ease-out"
          style={{
            width: "calc(33.333% - 4px)",
            left:
              selected === "yes"
                ? "4px"
                : selected === "maybe"
                  ? "calc(33.333% + 2px)"
                  : selected === "no"
                    ? "calc(66.666%)"
                    : "4px",
            opacity: selected ? 1 : 0,
          }}
        />
        <div
          className={cn(
            "rounded-full flex-1 relative z-10 transition-colors cursor-pointer flex items-center justify-center py-2 font-medium",
            selected === "yes" ? "text-background" : "text-foreground",
          )}
          onClick={handleYes}
        >
          Yes
        </div>
        <div
          className={cn(
            "rounded-full flex-1 relative z-10 transition-colors cursor-pointer flex items-center justify-center py-2 font-medium",
            selected === "maybe" ? "text-background" : "text-foreground",
          )}
          onClick={handleMaybe}
        >
          Maybe
        </div>
        <div
          className={cn(
            "rounded-full flex-1 relative z-10 transition-colors cursor-pointer flex items-center justify-center py-2 font-medium",
            selected === "no" ? "text-background" : "text-foreground",
          )}
          onClick={handleNo}
        >
          No
        </div>
      </div>
      {cancelDir === "end" &&
        (selected ? (
          <div
            className="rounded-full w-8 h-8 relative z-10 transition-all cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground animate-in fade-in"
            onClick={handleClear}
          >
            <X size={16} />
          </div>
        ) : (
          <X size={16} className="opacity-0 w-8 h-8" />
        ))}
    </div>
  );
}

function EventPage() {
  const { handle, rkey } = Route.useParams();
  const qt = useQt();

  const bskyClient = new Client({
    handler: simpleFetchHandler({ service: "https://public.api.bsky.app" }),
  });

  // resolve handle to DID and get profile - try aktivi first, fallback to bluesky
  const {
    data: resolvedData,
    isLoading: didLoading,
    error: didError,
  } = useQuery({
    queryKey: ["resolve-handle", handle],
    queryFn: async () => {
      // first try our own profile endpoint
      try {
        const response = await qt.client.get("co.aktivi.actor.getProfileView", {
          params: { actor: handle as any },
        });
        if (!isXRPCErrorPayload(response.data)) {
          return {
            did: response.data.profile.did,
            profile: response.data.profile,
          };
        }
      } catch (e) {
        // if not found in our db, fall through to bluesky
      }

      // fallback to bluesky identity and profile
      const bskyResponse = await bskyClient.get(
        "com.atproto.identity.resolveHandle",
        {
          params: { handle: handle as any },
        },
      );
      if (isXRPCErrorPayload(bskyResponse.data)) {
        throw bskyResponse.data.error;
      }

      // fetch bluesky profile
      const profileResponse = await bskyClient.get(
        "app.bsky.actor.getProfile",
        {
          params: { actor: handle as any },
        },
      );
      if (isXRPCErrorPayload(profileResponse.data)) {
        throw profileResponse.data.error;
      }

      return {
        did: bskyResponse.data.did,
        profile: profileResponse.data,
      };
    },
  });

  const did = resolvedData?.did;

  // construct the AT URI from DID and rkey
  const uri = did
    ? (`at://${did}/community.lexicon.calendar.event/${rkey}` as ResourceUri)
    : null;

  const {
    data: eventData,
    isLoading: eventLoading,
    error: eventError,
  } = useQuery({
    queryKey: ["event", uri],
    queryFn: async () => {
      if (!uri) return null;
      const response = await qt.client.get("co.aktivi.event.getEventView", {
        params: { uri },
      });
      if (isXRPCErrorPayload(response.data)) {
        throw response.data.error;
      }
      // fill in profile datas for selected RSVPs
      try {
        if (response.data.event.selectedRsvps) {
          let rsvpList = response.data.event.selectedRsvps.map(
            (p) => p.did || p.handle,
          );
          // fetch profiles in bulk from bluesky
          const profiles = await Promise.all(
            response.data.event.selectedRsvps.map(async (profile) =>
              bskyClient
                .get("app.bsky.actor.getProfiles", {
                  params: { actors: rsvpList },
                })
                .then((res) => {
                  if (isXRPCErrorPayload(res.data)) {
                    throw res.data.error;
                  }
                  return (
                    res.data.profiles.find(
                      (p) =>
                        p.did === profile.did || p.handle === profile.handle,
                    ) || profile
                  );
                }),
            ),
          );
          response.data.event.selectedRsvps = profiles.map((p) => ({
            did: p.did,
            handle: p.handle,
            displayName: p.displayName,
            avatar: p.avatar,
          }));
        }
      } catch (e) {
        // ignore errors in fetching RSVP profiles
      }
      return response.data.event as EventViewDetailed;
    },
    enabled: !!uri,
  });

  const isLoading = didLoading || eventLoading;
  const error = didError || eventError;

  if (isLoading) {
    return (
      <div className="min-h-screen h-screen min-w-full flex items-center justify-center bg-background">
        <Throbber />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen h-screen min-w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <CircleAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <div className="text-lg text-destructive">failed to load event</div>
          <div className="text-sm text-muted-foreground">{String(error)}</div>
        </div>
      </div>
    );
  }

  if (!eventData) {
    return null;
  }

  // use bluesky profile data as fallback if event author doesn't have aktivi profile
  const hasAktiviProfile = !!(
    eventData.author.displayName || eventData.author.avatar
  );
  const authorProfile = hasAktiviProfile
    ? eventData.author
    : resolvedData?.profile || eventData.author;

  const record = eventData.record as any;
  const startsAt = record.startsAt ? new Date(record.startsAt) : null;
  const endsAt = record.endsAt ? new Date(record.endsAt) : null;
  const locations = record.locations as any[] | undefined;
  const uris = record.uris as any[] | undefined;

  // format a location object based on its type
  const formatLocation = (location: any): string => {
    if (typeof location === "string") {
      return location;
    }

    if (!location.$type) {
      return JSON.stringify(location);
    }

    switch (location.$type) {
      case "community.lexicon.location.address": {
        const parts = [
          location.name,
          location.street,
          location.locality,
          location.region,
          location.postalCode,
          location.country,
        ].filter(Boolean);
        return parts.join(", ");
      }
      case "community.lexicon.location.geo": {
        const parts = [
          location.name,
          `${location.latitude}, ${location.longitude}`,
        ].filter(Boolean);
        return parts.join(" · ");
      }
      case "community.lexicon.location.fsq": {
        const parts = [
          location.name,
          `Foursquare: ${location.fsq_place_id}`,
        ].filter(Boolean);
        return parts.join(" · ");
      }
      case "community.lexicon.location.hthree": {
        const parts = [location.name, `H3: ${location.value}`].filter(Boolean);
        return parts.join(" · ");
      }
      case "community.lexicon.calendar.event#uri": {
        return location.name || location.uri;
      }
      default:
        return JSON.stringify(location);
    }
  };

  return (
    <div className="min-h-screen h-full min-w-full flex flex-col items-center bg-background px-4">
      <div className="container py-12 max-w-4xl">
        {/* event header */}
        <div className="mb-12">
          <div className="flex items-start gap-6 mb-8">
            {/* event visual placeholder */}
            {/*<div className="relative h-32 w-32 shrink-0 rounded-xl border-2 bg-linear-to-br from-primary/20 via-primary/10 to-muted/30 flex items-center justify-center">
              <div className="text-lg font-bold text-primary/30 text-center leading-tight px-2">
                {record.name.split(" ").slice(0, 2).join("\n").toUpperCase()}
              </div>
            </div>*/}

            <div className="flex-1 space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                {record.name}
              </h1>

              {/* author info */}
              <div className="space-y-2">
                {hasAktiviProfile ? (
                  <Link
                    to="/user/$handle"
                    params={{
                      handle: authorProfile.handle || authorProfile.did,
                    }}
                    className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={authorProfile.avatar} />
                      <AvatarFallback>
                        {authorProfile.displayName?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {authorProfile.displayName || "user"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {authorProfile.handle || authorProfile.did}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <a
                    href={`https://bsky.app/profile/${authorProfile.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={authorProfile.avatar} />
                      <AvatarFallback>
                        {authorProfile.displayName?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {authorProfile.displayName || "user"} 。 Bluesky
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {authorProfile.handle || authorProfile.did}
                      </div>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* event meta */}
          <div className="grid gap-6">
            {/* date/time */}
            {startsAt && endsAt && startsAt.getDay() != endsAt.getDay() ? (
              <div className="flex items-start gap-4">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-lg flex flex-col">
                    <p>
                      {startsAt.toLocaleString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p>
                      <span className="text-muted-foreground">to</span>{" "}
                      {endsAt.toLocaleString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      <span className="text-muted-foreground">
                        ({Math.abs(endsAt.getDay() - startsAt.getDay())} days)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              startsAt && (
                <div className="flex items-start gap-4">
                  <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-lg">
                      {startsAt.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-muted-foreground">
                      {startsAt.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {endsAt && (
                        <>
                          {" – "}
                          {endsAt.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}

            {/* rsvp count */}
            {eventData.interestedCount !== undefined &&
              eventData.goingCount !== undefined &&
              eventData.interestedCount + eventData.goingCount > 0 && (
                <div className="flex items-start gap-4">
                  <Users className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-3">
                    {eventData.selectedRsvps &&
                    eventData.selectedRsvps.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {eventData.selectedRsvps.map((profile, idx) => (
                            <Link
                              key={idx}
                              to="/user/$handle"
                              params={{
                                handle: profile.handle || profile.did,
                              }}
                              className="group"
                            >
                              <Avatar className="h-8 w-8 ring-2 ring-background hover:ring-primary transition-all">
                                <AvatarImage src={profile.avatar} />
                                <AvatarFallback className="text-xs">
                                  {profile.displayName?.[0] || "?"}
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                          ))}
                          {eventData.goingCount -
                            eventData.selectedRsvps.length >
                            0 && (
                            <Avatar className="h-8 w-8 ring-2 ring-background hover:ring-primary transition-all">
                              <AvatarFallback className="text-xs">
                                +
                                {eventData.goingCount -
                                  eventData.selectedRsvps.length}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        {eventData.goingCount}{" "}
                        {eventData.goingCount === 1 ? "person" : "people"}{" "}
                        going, {eventData.interestedCount} interested
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        {eventData.goingCount}{" "}
                        {eventData.goingCount === 1 ? "person" : "people"}{" "}
                        going, {eventData.interestedCount} interested
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* locations */}
            {locations && locations.length > 0 && (
              <div className="flex items-start gap-4 text-muted-foreground">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {locations.map((location, idx) => (
                    <div key={idx}>{formatLocation(location)}</div>
                  ))}{" "}
                  (
                  {ModeDisplay[record.mode as keyof typeof ModeDisplay] ||
                    record.mode}
                  )
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-row items-center justify-between gap-4 pb-12">
          <h3 className="text-2xl font-semibold">Are you going?</h3>
          <div className="h-0 min-w-8 border-t shrink-0 flex-0" />
          <div className="max-w-xs flex-1">
            <YesNoMaybe
              cid={eventData.cid}
              uri={eventData.uri}
              prevrkey={
                eventData.currentUserRsvpUri?.split("/").pop() || undefined
              }
              currentStatus={eventData.currentUserStatus}
              currentRsvpUri={eventData.currentUserRsvpUri}
              cancelDir="start"
            />
          </div>
        </div>

        {/* description */}
        {record.description && (
          <div className="bg-card border-2 border-border rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">About</h2>
            <div className="text-lg text-foreground/80 prose prose-lg dark:prose-invert max-w-none">
              <ReactMarkdown>{record.description}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* links */}
        {uris && uris.length > 0 && (
          <div className="flex items-start gap-4 pt-8">
            <ExternalLink className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2">
              {uris.map((uri, idx) => {
                const isUriObject =
                  typeof uri === "object" &&
                  uri.$type === "community.lexicon.calendar.event#uri";
                const href = isUriObject ? uri.uri : uri;
                const label = isUriObject ? uri.name || uri.uri : uri;

                return (
                  <a
                    key={idx}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-primary hover:underline break-all"
                  >
                    {label} ({new URL(href).hostname.trim().replace("www.", "")}
                    )
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
