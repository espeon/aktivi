import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Calendar, Menu, X, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme";
import { useAuth } from "@/lib/use-auth";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { session, signOut } = useAuth();

  return (
    <>
      <header className="sticky px-4 top-0 z-40 w-full flex items-center justify-center border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-14 items-center">
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

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session ? (
              <>
                <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                  <User size={16} />
                  {session.info.sub}
                </div>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut size={16} className="mr-2" />
                  sign out
                </Button>
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
            {session ? (
              <>
                <div className="flex items-center gap-3 p-3 text-sm text-muted-foreground">
                  <User size={20} />
                  <span>{session.info.sub}</span>
                </div>
                <button
                  onClick={() => {
                    signOut();
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
