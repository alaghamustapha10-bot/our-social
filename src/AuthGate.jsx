import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted) {
        setSession(error ? null : data.session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div>Loading OUR SOCIAL...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return children;
}