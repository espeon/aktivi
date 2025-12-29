import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  Users,
  MapPin,
  ChevronRight,
  MousePointer2,
  X,
  Check,
  Building2,
  Globe,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const PFP_URLS = [
  "https://cdn.bsky.app/img/avatar/plain/did:plc:oisofpd7lj26yvgiivf3lxsi/bafkreibhsikkbqnkfwsfx53x6ajv7d4un2tvphcyxaej5mdcad563wqoli@jpeg",
  "https://cdn.bsky.app/img/avatar/plain/did:plc:tas6hj2xjrqben5653v5kohk/bafkreifikgubrjlqzu7zst2yiwizjouvu6yoocnbumiywov7idd3g5agxu@jpeg",
  "https://cdn.bsky.app/img/avatar/plain/did:plc:k644h4rq5bjfzcetgsa6tuby/bafkreibjnhqfhangwgwam5msfpqu64qazduai7n25ttiiihnttcgeabnua@jpeg",
  "https://cdn.bsky.app/img/avatar/plain/did:plc:p572wxnsuoogcrhlfrlizlrb/bafkreicsvua5wy6s5qyclq6fswttccfnpltfrbfzsvli7wdptat4jpxlse@jpeg",
  "https://cdn.bsky.app/img/avatar/plain/did:plc:ufskztrjiuz2k7wmooszs3eb/bafkreicxuauuia6xvxc73vxkxq5nywg3ukklpwy5afni7z3ikcfznc4cmm@jpeg",
];

function HomePage() {
  const { session } = useAuth();

  return (
    <div className="min-h-full min-w-full flex flex-col items-center  px-4">
      {/* hero section */}
      <section className="container py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* left pane - messaging */}
          <div className="space-y-10">
            <div className="space-y-6">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9]">
                plan activities
                <br />
                with your network
              </h1>
              <p className="text-2xl md:text-3xl text-muted-foreground max-w-lg leading-tight">
                make, organize and discover events across the
                <span className="text-foreground"> Atmosphere</span> with aktivi
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {session ? (
                <>
                  <Link to="/events">
                    <Button size="lg" className="text-base">
                      browse events <ChevronRight className="h-5 w-5 mt-0.5" />
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline" className="text-base">
                    create an event <Plus className="h-5 w-5 mt-0.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/events">
                    <Button size="lg" variant="outline">
                      explore
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg">
                      get started <ChevronRight className="h-5 w-5 mt-0.5" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* right pane - event mockup */}
          <div className="relative lg:h-[600px] flex items-center">
            {/* decorative elements */}
            <div className="absolute -z-10 top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -z-10 bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />

            <div className="w-full">
              {/* mock event card - larger and more prominent */}
              <div className="bg-card border-2 border-border rounded-2xl shadow-2xl shadow-primary/5 overflow-hidden rotate-1 hover:rotate-0 transition-transform">
                <div className="p-8 space-y-6">
                  {/* event header */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-2xl leading-tight mb-1">
                        Seattle Mechanical Keyboards Meetup
                      </h3>
                      <p className="text-muted-foreground">
                        by @alice.bsky.social
                      </p>
                    </div>
                  </div>

                  {/* event details */}
                  <div className="space-y-3 text-base">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <span>sat, jan 15 · 2:00 pm</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <span>
                        Stoup Brewing{" "}
                        <span className="text-muted-foreground">
                          (in person)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex -space-x-2">
                        {PFP_URLS.slice(0, 4).map((url, i) => (
                          <img
                            src={url}
                            key={i}
                            className="w-7 h-7 rounded-full border-2 border-card object-cover"
                          />
                        ))}
                        <div className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-medium">
                          <div>+8</div>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        going
                      </span>
                    </div>
                  </div>

                  {/* description */}
                  <p className="text-base text-muted-foreground leading-relaxed border-l-2 border-primary/20 pl-4 line-clamp-3">
                    {`Bring your thirst and your keebs! Stoup Brewing is family & pet friendly, so feel free to bring your family! If you're underaged, don't worry about not being able to join.

                  Don't forget:
                  - Parking on Saturdays are NOT FREE. There is free parking a few blocks east, closer to Seattle University if you don't mind walking ~10 minutes.
                  - There is a 2 TKL sized board "limit" per person
                  - Please respect other people's boards and handle with care if you are allowed to handle them
                  - Clean up after yourself, our space should be the same, if not better than how it started (i.e. clean and neatly packed)`
                      .split("\n")
                      .map((line, i) => (
                        <span key={i} className={i === 0 ? "" : "block mt-1"}>
                          {line.trim()}
                        </span>
                      ))}
                  </p>

                  {/* actions */}
                  <div className="flex gap-3 pt-2 relative">
                    <div className="flex-1 relative">
                      <Button className="w-full h-12 text-base font-semibold animate-button-click">
                        i'm going
                      </Button>
                      {/* particles */}
                      <div className="absolute left-auto right-[18%] top-6 pointer-events-none">
                        <div className="absolute w-2 h-2 rounded-full bg-accent animate-particle-1" />
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-accent animate-particle-2" />
                        <div className="absolute w-2 h-2 rounded-full bg-accent animate-particle-3" />
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-accent animate-particle-4" />
                        <MousePointer2
                          strokeWidth={1}
                          className="absolute h-12 w-12 -ml-1 -mt-1 blur-lg text-primary fill-primary animate-cursor-slide pointer-events-none"
                        />
                        <MousePointer2
                          strokeWidth={1}
                          className="absolute h-12 w-12 -ml-1 -mt-1 text-muted-foreground fill-accent animate-cursor-slide pointer-events-none"
                        />
                      </div>
                    </div>
                    <Button variant="outline" className="flex-1 h-12 text-base">
                      interested
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* how it works - asymmetric bento */}
      <section className="container py-24">
        <h2 className="text-4xl md:text-5xl font-bold mb-16 max-w-2xl">
          events that live
          <br />
          with your identity
        </h2>

        <div className="grid md:grid-cols-12 gap-6 auto-rows-fr">
          {/* large feature - decentralized */}
          <div className="md:col-span-7 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border rounded-2xl p-8 md:p-12 flex flex-col justify-between min-h-[320px]">
            <div className="space-y-4">
              <div className="text-6xl md:text-7xl font-bold text-primary/20">
                01
              </div>
              <h3 className="text-3xl font-bold">your data, your control</h3>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                events are published to your own personal data server, not
                locked in some company's huge data lake. they're portable,
                permanent, and tied to your identity.
              </p>
            </div>
          </div>

          {/* tall feature - network */}
          <div className="md:col-span-5 bg-muted/50 border border-border rounded-2xl p-8 flex flex-col justify-between min-h-[320px]">
            <div className="space-y-6">
              <Users className="h-12 w-12 text-primary" />
              <div className="space-y-3">
                <h3 className="text-2xl font-bold">built for your network</h3>
                <p className="text-muted-foreground leading-relaxed">
                  discover events from people you already follow. no algorithm,
                  no ads, just your community.
                </p>
              </div>
            </div>
            <div className="pt-6 flex -space-x-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
              <div className="w-10 h-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground">
                +42
              </div>
            </div>
          </div>

          {/* wide feature - rsvp */}
          <div className="md:col-span-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-border rounded-2xl p-8 flex flex-col justify-between min-h-[280px]">
            <div className="space-y-4">
              <Calendar className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              <h3 className="text-2xl font-bold">rsvp with one tap</h3>
              <p className="text-muted-foreground leading-relaxed">
                going, interested, or not going. your response is signed and
                verifiable.
              </p>
            </div>
          </div>

          {/* stats block */}
          <div className="md:col-span-7 border border-border rounded-2xl p-8 md:p-12 bg-card min-h-[280px] flex items-center">
            <div className="grid grid-cols-2 gap-8 w-full">
              <div>
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2">
                  100%
                </div>
                <div className="text-sm text-muted-foreground">
                  decentralized hosting
                </div>
              </div>
              <div>
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2">
                  0
                </div>
                <div className="text-sm text-muted-foreground">
                  vendor lock-in
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2">
                  ∞
                </div>
                <div className="text-sm text-muted-foreground">
                  events you can create and share
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* how it works - alternating two-pane layouts */}
      <section className="container py-32 overflow-hidden">
        <h2 className="text-5xl md:text-6xl font-bold mb-8 lg:text-center">
          from idea to event
        </h2>
        <p className="text-xl md:text-2xl text-muted-foreground lg:text-center mb-24 max-w-3xl mx-auto">
          transform your plans into discoverable, verifiable events.
          <br /> in three simple steps.
        </p>

        <div className="relative max-w-7xl mx-auto space-y-32">
          {/* step 1 - create (text left, mockup right) */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* left - description */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  1
                </div>
                <div>
                  <h3 className="text-3xl md:text-4xl font-bold">
                    create your event
                  </h3>
                  <p className="text-muted-foreground">
                    simple form, powerful results
                  </p>
                </div>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                fill out a simple form with your event details. when you
                publish, the event gets written directly to your own data
                repository on atproto and signed with your identity. this means
                you own the data, and it stays with your identity wherever you
                go on the network.
              </p>
            </div>

            {/* right - form mockup */}
            <div className="relative">
              <div className="bg-card border-2 border-border rounded-3xl p-8 shadow-2xl">
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      event name
                    </label>
                    <div className="h-12 bg-background rounded-lg border-2 border-border flex items-center px-4">
                      <span className="text-sm">coffee & code meetup</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">
                        date
                      </label>
                      <div className="h-12 bg-background rounded-lg border-2 border-border flex items-center px-3">
                        <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                        <span className="text-sm">jan 15</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">
                        time
                      </label>
                      <div className="h-12 bg-background rounded-lg border-2 border-border flex items-center px-3">
                        <span className="text-sm">2:00 pm</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      location
                    </label>
                    <div className="h-12 bg-background rounded-lg border-2 border-border flex items-center px-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mr-2" />
                      <span className="text-sm">
                        downtown coffee collective
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      description
                    </label>
                    <div className="h-28 bg-background rounded-lg border-2 border-border p-3">
                      <span className="text-sm text-muted-foreground leading-relaxed">
                        let's meet up to work on projects and chat about tech...
                      </span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full mt-4 text-lg font-semibold"
                  >
                    share event <ChevronRight className="h-6 w-6 mt-0.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* step 2 - discover (mockup left, text right) */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* left - feed mockup */}
            <div className="relative lg:order-1 order-2">
              <div className="bg-card border-2 border-border rounded-3xl p-8 shadow-2xl">
                <div className="space-y-4">
                  {/* feed header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-border">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">your network</span>
                  </div>

                  {/* feed items */}
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl ${i === 2 ? "bg-amber-500/10 border-2 border-amber-500/30" : "bg-muted/30"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-muted rounded w-32" />
                          <div className="h-4 bg-foreground/10 rounded w-full" />
                          <div className="flex items-center gap-2 pt-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <div className="h-2 bg-muted rounded w-24" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* right - description */}
            <div className="space-y-6 lg:order-2 order-1">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  2
                </div>
                <div>
                  <h3 className="text-3xl md:text-4xl font-bold">
                    your network discovers it
                  </h3>
                  <p className="text-muted-foreground">
                    shared with people who follow you
                  </p>
                </div>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                your event shows up chronologically in the feeds of people who
                follow you. there's no algorithm deciding visibility, just your
                community seeing what you share. because it lives on atproto,
                the event is discoverable across any app that speaks the
                protocol, and is compatible with our schema.
              </p>
            </div>
          </div>

          {/* step 3 - track (text left, mockup right) */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* left - description */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  3
                </div>
                <div>
                  <h3 className="text-3xl md:text-4xl font-bold">
                    track who's coming
                  </h3>
                  <p className="text-muted-foreground">verifiable RSVPing</p>
                </div>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                rsvps get written to each attendee's own personal data server
                and signed with their identity. this makes every response
                permanently verifiable: attendees now have a history of
                participation that belongs to them and travels with their
                identity across the network.
              </p>
            </div>

            {/* right - rsvp mockup */}
            <div className="relative">
              <div className="bg-card border-2 border-border rounded-3xl p-8 shadow-2xl">
                <div className="space-y-6">
                  {/* rsvp buttons */}
                  <div className="flex gap-3">
                    <div className="flex-1 h-14 bg-primary/20 border-2 border-primary rounded-xl flex items-center justify-center">
                      <span className="text-base font-semibold text-primary">
                        going
                      </span>
                    </div>
                    <div className="flex-1 h-14 bg-muted/30 border border-border rounded-xl flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">
                        interested
                      </span>
                    </div>
                  </div>

                  {/* attendees section */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">24 going</span>
                      <span className="text-xs text-muted-foreground">
                        12 interested
                      </span>
                    </div>

                    <div className="flex -space-x-3">
                      {PFP_URLS.map((url, i) => (
                        <img
                          src={url}
                          key={i}
                          className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-3 border-card flex items-center justify-center text-sm font-medium shadow-md"
                        />
                      ))}
                      <div className="w-12 h-12 rounded-full bg-muted border-3 border-card flex items-center justify-center text-xs shadow-md">
                        +19
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* interop section */}
      <section className="container py-24">
        <div className="relative bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-3xl p-6 md:p-16 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -z-10" />

          <div className="max-w-3xl">
            <div className="inline-block px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm font-medium mb-6">
              futureproof by design
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              built on open standards
            </h2>

            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              we interoperate with existing platforms, such as{" "}
              <a
                href="https://smokesignal.events"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-semibold hover:text-amber-600 dark:hover:text-amber-400 transition-colors underline decoration-amber-500/30 underline-offset-4"
              >
                smokesignal.events
              </a>
              . events created on aktivi appear there, and vice versa. <br />
              same protocol and data, just different interfaces.
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>shared event schema</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>cross-platform rsvps</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>no lock-in</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* comparison section - split screen */}
      <section className="container py-24">
        <h2 className="text-4xl md:text-5xl font-bold mb-16 text-center max-w-3xl mx-auto">
          choose the atmosphere
        </h2>

        <div className="relative max-w-6xl mx-auto overflow-hidden rounded-3xl border-2 border-border">
          {/* diagonal split line */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-transparent via-border/50 to-transparent pointer-events-none"
            style={{ clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)" }}
          />

          <div className="grid md:grid-cols-2">
            {/* left side - traditional (muted) */}
            <div className="bg-muted/30 p-10 md:p-12 space-y-8 relative">
              <div className="absolute top-6 right-6 opacity-10">
                <Building2 className="h-32 w-32" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-3xl font-bold text-muted-foreground">
                    traditional
                  </h3>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <X className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground mb-1">
                        platform owns your data
                      </p>
                      <p className="text-sm text-muted-foreground">
                        locked in their database forever
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <X className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground mb-1">
                        algorithmic visibility
                      </p>
                      <p className="text-sm text-muted-foreground">
                        they decide who sees your events
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <X className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground mb-1">
                        platform shuts down?
                      </p>
                      <p className="text-sm text-muted-foreground">
                        your events disappear with it
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* right side - aktivi (highlighted) */}
            <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-10 md:p-12 space-y-8 relative border-l-2 border-primary/20">
              <div className="absolute top-6 right-6 opacity-10">
                <Globe className="h-32 w-32 text-primary" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <Globe className="h-10 w-10 text-primary" />
                  <h3 className="text-3xl font-bold">aktivi</h3>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <Check className="h-6 w-6 text-primary mt-0.5 flex-shrink-0 stroke-[3]" />
                    <div>
                      <p className="font-bold text-foreground mb-1">
                        you own your data
                      </p>
                      <p className="text-sm text-muted-foreground">
                        published to your own personal data server, portable
                        anywhere
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Check className="h-6 w-6 text-primary mt-0.5 flex-shrink-0 stroke-[3]" />
                    <div>
                      <p className="font-bold text-foreground mb-1">
                        network-based discovery
                      </p>
                      <p className="text-sm text-muted-foreground">
                        your followers see your events, no algorithm
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Check className="h-6 w-6 text-primary mt-0.5 flex-shrink-0 stroke-[3]" />
                    <div>
                      <p className="font-bold text-foreground mb-1">
                        permanent & verifiable
                      </p>
                      <p className="text-sm text-muted-foreground">
                        cryptographically signed, lives on atproto
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* cta section */}
      <section className="container py-24">
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 rounded-3xl p-12 md:p-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            ready to plan something?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            join the growing community organizing events on atproto
          </p>
          {session ? (
            <Link to="/events">
              <Button size="lg" className="text-base px-8">
                browse events
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button size="lg" className="text-base px-8">
                sign in to get started
              </Button>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
