import { createContext, useEffect, useState, type ReactNode } from "react";
import {
  getSession,
  createAuthorizationUrl,
  type Session,
} from "@atcute/oauth-browser-client";
import { initOAuth } from "./oauth";
import type { ActorIdentifier, Did } from "@atcute/lexicons";

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  signIn: (handle: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // initialize OAuth configuration
    initOAuth();

    // try to restore existing session
    const restoreSession = async () => {
      try {
        // TODO: get DID from localStorage or URL params after callback
        const did = localStorage.getItem("aktivi_user_did");
        if (did) {
          const existingSession = await getSession(did as Did, {
            allowStale: true,
          });
          setSession(existingSession);
        }
      } catch (error) {
        console.log("no existing session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const signIn = async (handle: string) => {
    try {
      setIsLoading(true);

      // create authorization URL
      const authUrl = await createAuthorizationUrl({
        target: { type: "account", identifier: handle as ActorIdentifier },
        scope: "atproto transition:generic",
      });

      // let browser persist local storage before redirect
      await new Promise((resolve) => setTimeout(resolve, 200));

      // redirect to authorization
      window.location.assign(authUrl);
    } catch (error) {
      console.error("sign in failed:", error);
      setIsLoading(false);
      throw error;
    }
  };

  const signOut = () => {
    // clear session
    setSession(null);

    // clear stored DID
    localStorage.removeItem("aktivi_user_did");

    // TODO: implement proper OAuth session cleanup with deleteStoredSession
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
