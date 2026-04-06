import * as prismatic from "@prismatic-io/embedded";
import { useEffect, useRef, useState } from "react";

interface AuthState {
  authenticated: boolean;
  error: string | null;
}

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/authenticate");
  if (!res.ok) throw new Error("Failed to fetch auth token");
  const { token } = await res.json();
  return token;
}

export default function usePrismaticAuth(
  tokenValidSeconds: number = 3600
): AuthState {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    let mounted = true;

    const authenticate = async () => {
      try {
        const token = await fetchToken();
        await prismatic.authenticate({ token });
        if (mounted) setState({ authenticated: true, error: null });
      } catch (err) {
        if (mounted)
          setState({
            authenticated: false,
            error:
              err instanceof Error ? err.message : "Authentication failed",
          });
      }
    };

    authenticate();

    // Refresh 30 seconds before expiration
    intervalRef.current = setInterval(
      authenticate,
      (tokenValidSeconds - 30) * 1000
    );

    return () => {
      mounted = false;
      clearInterval(intervalRef.current);
    };
  }, [tokenValidSeconds]);

  return state;
}
