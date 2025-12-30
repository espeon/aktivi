import { X } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import { useQt } from "@/lib/qt";
import { Input } from "./ui/input";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "./ui/textarea";
import type { Did } from "@atcute/lexicons";
import { isXRPCErrorPayload } from "@atcute/client";

interface OOTBModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export function OOTBModal({ onClose, onComplete }: OOTBModalProps) {
  const [page, setPage] = useState(0);
  const qt = useQt();

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [bskyProfile, setBskyProfile] = useState<any>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // fetch bluesky profile on mount if we have a session
  useEffect(() => {
    const fetchBskyProfile = async () => {
      if (!qt.did) return;

      try {
        // fetch from bsky public appview (no auth needed)
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${qt.did}`,
        );
        const data = await res.json();

        if (data.displayName || data.description) {
          setBskyProfile(data);
          setDisplayName(data.displayName || "");
          setDescription(data.description || "");
        }
      } catch (err) {
        console.error("failed to fetch bsky profile:", err);
      }
    };

    fetchBskyProfile();
  }, [qt.did]);

  const createProfile = useMutation({
    mutationFn: async () => {
      if (!qt.did) return;

      let avatarBlob = null;

      // upload avatar if provided
      if (avatarFile) {
        const uploadRes = await qt.client.post("com.atproto.repo.uploadBlob", {
          input: await avatarFile.arrayBuffer(),
        });

        // if upload failed, proceed without avatar
        if (isXRPCErrorPayload(uploadRes.data)) {
          console.error("avatar upload failed:", uploadRes.data);
          return;
        }
        avatarBlob = uploadRes.data.blob;
      }

      await qt.client.post("com.atproto.repo.putRecord", {
        input: {
          repo: qt.did as Did,
          collection: "co.aktivi.actor.profile",
          rkey: "self",
          record: {
            displayName,
            description,
            ...(avatarBlob && { avatar: avatarBlob }),
          },
        },
      });
    },
    onSuccess: () => {
      onComplete();
    },
  });

  const pages = [
    {
      content: (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-5xl font-bold tracking-tight">
              your calendar,
              <br />
              your server
            </h2>
            <p className="text-xl text-muted-foreground max-w-md">
              events live on your PDS. aktivi just helps people find them.
            </p>
          </div>

          <div className="grid gap-4 max-w-md">
            <div className="flex gap-4 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <p className="text-base">
                delete aktivi tomorrow, your events stay on your server
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <p className="text-base">
                any AT Protocol app can read and write your events
              </p>
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <p className="text-base">no one sits between you and your data</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      content: (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-5xl font-bold tracking-tight">
              post once,
              <br />
              show everywhere
            </h2>
            <p className="text-xl text-muted-foreground max-w-md">
              publish an event record to your PDS and watch it sync across the
              network
            </p>
          </div>

          <div className="relative max-w-md">
            <div className="absolute left-[19px] top-12 bottom-12 w-px bg-gradient-to-b from-primary via-primary/50 to-transparent" />

            <div className="space-y-8">
              <div className="flex gap-5 items-start relative">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 relative z-10">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div className="pt-1.5">
                  <h5 className="font-semibold mb-1 text-lg">you publish</h5>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">
                      community.lexicon.calendar.event
                    </code>{" "}
                    hits your PDS
                  </p>
                </div>
              </div>

              <div className="flex gap-5 items-start relative">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 relative z-10">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div className="pt-1.5">
                  <h5 className="font-semibold mb-1 text-lg">we index</h5>
                  <p className="text-sm text-muted-foreground">
                    aktivi sees it in the firehose, adds to timeline
                  </p>
                </div>
              </div>

              <div className="flex gap-5 items-start relative">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 relative z-10">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div className="pt-1.5">
                  <h5 className="font-semibold mb-1 text-lg">
                    everyone discovers
                  </h5>
                  <p className="text-sm text-muted-foreground">
                    your event is live for the whole Atmosphere
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      content: (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-5xl font-bold tracking-tight">who are you?</h2>
            <p className="text-xl text-muted-foreground max-w-md">
              {bskyProfile
                ? "we pulled your bluesky info"
                : "set up your profile"}
            </p>
          </div>

          <div className="space-y-5 max-w-md justify-between flex flex-col flex-1">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">
                  display name
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="your name"
                  className="text-base"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">bio</label>
                  <span className="text-xs text-muted-foreground">
                    {description.length}/256
                  </span>
                </div>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 256))}
                  placeholder="tell people about yourself"
                  className="text-base"
                  wrap="soft"
                  rows={4}
                />
                {bskyProfile && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    from @{bskyProfile.handle}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      content: (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-5xl font-bold tracking-tight">
              put a face to the name
            </h2>
            <p className="text-xl text-muted-foreground max-w-md">
              help people recognize you at events
            </p>
          </div>

          <div className="space-y-6 pt-4">
            <div className="flex flex-col items-center gap-6">
              <div className="w-48 h-48 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : bskyProfile?.avatar ? (
                  <img
                    src={bskyProfile.avatar}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl text-muted-foreground">?</span>
                )}
              </div>

              <div className="text-center space-y-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size <= 1000000) {
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setAvatarPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium cursor-pointer hover:bg-primary/90 transition-colors text-sm"
                >
                  {avatarPreview ? "change photo" : "upload photo"}
                </label>
                <p className="text-xs text-muted-foreground">
                  png or jpeg, max 1MB
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentPage = pages[page];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/50 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative p-8 md:p-12">
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="min-h-[420px] relative overflow-hidden">
              <div
                key={page}
                className="animate-in fade-in slide-in-from-right-8 duration-300"
              >
                {currentPage.content}
              </div>
            </div>

            <div className="flex items-center justify-between gap-6 mt-12 pt-8 border-t border-border/30">
              <div className="flex gap-1.5">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === page
                        ? "w-8 bg-primary"
                        : "w-1.5 bg-border hover:bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="text-muted-foreground"
                >
                  skip
                </Button>
                {page > 0 && (
                  <Button variant="outline" onClick={() => setPage(page - 1)}>
                    back
                  </Button>
                )}
                {page < pages.length - 1 ? (
                  <Button onClick={() => setPage(page + 1)}>next</Button>
                ) : (
                  <Button
                    onClick={() => createProfile.mutate()}
                    disabled={createProfile.isPending || !displayName}
                  >
                    {createProfile.isPending ? "saving..." : "let's go"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
