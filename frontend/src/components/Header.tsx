import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Home, Calendar, Menu, X, LogIn, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme";
import { useQt } from "@/lib/qt";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Did } from "@atcute/lexicons";
import { isXRPCErrorPayload } from "@atcute/client";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const qt = useQt();
  const [profile, setProfile] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollThreshold = 50;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > scrollThreshold) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!qt.did) return;

      try {
        const res = await qt.client.get("co.aktivi.actor.getProfileView", {
          params: { actor: qt.did as Did },
        });
        if (isXRPCErrorPayload(res.data)) {
          throw res.data.error;
        }
        setProfile(res.data.profile);
      } catch (err) {
        console.error("failed to fetch profile:", err);
      }
    };

    fetchProfile();
  }, [qt.did, qt.client]);

  return (
    <>
      <header
        className={
          "sticky px-4 top-0 z-40 w-full flex items-center justify-center"
        }
      >
        <div
          className={
            "container flex items-center transition-all border" +
            (scrolled
              ? " px-8 h-14 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70 rounded-full mt-2"
              : " px-0 h-16 mt-4 border-background")
          }
        >
          <button
            onClick={() => setIsOpen(true)}
            className="mr-4 p-2 hover:bg-accent rounded-md transition-colors md:hidden"
            aria-label="open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-6 flex-1">
            <Link to="/" className="font-bold text-xl">
              aktivi
            </Link>

            <nav className="hidden md:flex gap-6">
              <Link
                to="/"
                className="text-sm font-medium transition-colors hover:text-foreground/80 text-foreground/60"
                activeProps={{
                  className: "text-sm font-medium text-foreground",
                }}
              >
                <div className="flex items-center gap-2">
                  <Home size={16} />
                  home
                </div>
              </Link>
              <Link
                to="/events"
                className="text-sm font-medium transition-colors hover:text-foreground/80 text-foreground/60"
                activeProps={{
                  className: "text-sm font-medium text-foreground",
                }}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  events
                </div>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-1">
            {qt.isLoggedIn ? (
              <>
                <Link to="/events/create">
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    className="rounded-full max-h-7 max-w-7"
                  >
                    <Plus />
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={profile?.avatar} />
                        <AvatarFallback className="text-xs">
                          {profile?.displayName?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {profile?.handle || qt.did}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="flex items-center gap-3 p-1">
                      <Avatar className="h-14 w-14">
                        <AvatarImage
                          className="h-14 w-14"
                          src={profile?.avatar}
                        />
                        <AvatarFallback className="h-14 w-14">
                          {profile?.displayName?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate">
                          {profile?.displayName || "user"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {profile?.handle || qt.did}
                        </span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={qt.logout}>
                      <LogOut size={16} className="mr-2" />
                      sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  <LogIn size={16} className="mr-2" />
                  sign in
                </Button>
              </Link>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-background border-r shadow-lg z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto space-y-2">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors"
            activeProps={{
              className:
                "flex items-center gap-3 p-3 rounded-md bg-accent font-medium transition-colors",
            }}
          >
            <Home size={20} />
            <span>home</span>
          </Link>

          <Link
            to="/events"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors"
            activeProps={{
              className:
                "flex items-center gap-3 p-3 rounded-md bg-accent font-medium transition-colors",
            }}
          >
            <Calendar size={20} />
            <span>events</span>
          </Link>

          <div className="pt-4 border-t mt-4">
            {qt.isLoggedIn ? (
              <>
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar} />
                    <AvatarFallback>
                      {profile?.displayName?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {profile?.displayName || "User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {profile?.handle || qt.did}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    qt.logout();
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors w-full"
                >
                  <LogOut size={20} />
                  <span>sign out</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors"
              >
                <LogIn size={20} />
                <span>sign in</span>
              </Link>
            )}
          </div>
        </nav>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="close menu overlay"
        />
      )}
    </>
  );
}
