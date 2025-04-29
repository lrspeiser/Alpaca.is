import { useState, useEffect } from 'react';
import { getClientId } from '@/lib/utils';

interface ClientUser {
  userId: number;
  clientId: string;
  lastVisitedAt: string;
}

// Singleton state for client registration to prevent multiple registrations
let globalClientId: string | null = null;
let globalUser: ClientUser | null = null;
let globalIsRegistered = false;
let globalIsLoading = true;
let globalError: string | null = null;
let registrationPromise: Promise<void> | null = null;

// Function to handle the registration process once
async function registerClientOnce() {
  if (registrationPromise) {
    return registrationPromise;
  }
  
  registrationPromise = (async () => {
    try {
      // Get or generate client ID
      const id = getClientId();
      globalClientId = id;

      // Register with the server (only once)
      console.log('[CLIENT] Registering client ID:', id);
      const response = await fetch('/api/register-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId: id }),
      });

      if (response.ok) {
        const data = await response.json();
        globalUser = {
          userId: data.userId,
          clientId: data.clientId,
          lastVisitedAt: data.lastVisitedAt
        };
        globalIsRegistered = true;
        console.log('[CLIENT] Successfully registered client ID');
      } else {
        globalError = 'Failed to register client';
        console.error('[CLIENT] Failed to register client');
      }
    } catch (err) {
      globalError = err instanceof Error ? err.message : 'Unknown error';
      console.error('[CLIENT] Error registering client:', err);
    } finally {
      globalIsLoading = false;
    }
  })();
  
  return registrationPromise;
}

/**
 * Hook to manage client ID-based user identification
 * Returns the client ID and a flag indicating if registration was successful
 * Uses a singleton pattern to prevent multiple registrations
 */
export function useClientId() {
  const [clientId, setClientId] = useState<string | null>(globalClientId);
  const [user, setUser] = useState<ClientUser | null>(globalUser);
  const [isRegistered, setIsRegistered] = useState(globalIsRegistered);
  const [isLoading, setIsLoading] = useState(globalIsLoading);
  const [error, setError] = useState<string | null>(globalError);

  useEffect(() => {
    // If already registered, just update local state
    if (globalIsRegistered) {
      setClientId(globalClientId);
      setUser(globalUser);
      setIsRegistered(true);
      setIsLoading(false);
      return;
    }

    // Register only once across all component instances
    registerClientOnce().then(() => {
      setClientId(globalClientId);
      setUser(globalUser);
      setIsRegistered(globalIsRegistered);
      setIsLoading(globalIsLoading);
      setError(globalError);
    });
  }, []);

  return { clientId, user, isRegistered, isLoading, error };
}