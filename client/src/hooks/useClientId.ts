import { useState, useEffect } from 'react';
import { getClientId } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface ClientUser {
  userId: number;
  clientId: string;
  lastVisitedAt: string;
}

/**
 * Hook to manage client ID-based user identification
 * Returns the client ID and a flag indicating if registration was successful
 */
export function useClientId() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [user, setUser] = useState<ClientUser | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function registerClient() {
      try {
        // Get or generate client ID
        const id = getClientId();
        setClientId(id);

        // Register with the server
        console.log('[CLIENT] Registering client ID:', id);
        const response = await apiRequest<{ success: boolean; userId: number; clientId: string; lastVisitedAt: string }>({
          url: '/api/register-client',
          method: 'POST',
          body: { clientId: id },
        });

        if (response.success) {
          setUser({
            userId: response.userId,
            clientId: response.clientId,
            lastVisitedAt: response.lastVisitedAt
          });
          setIsRegistered(true);
          console.log('[CLIENT] Successfully registered client ID');
        } else {
          setError('Failed to register client');
          console.error('[CLIENT] Failed to register client');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('[CLIENT] Error registering client:', err);
      } finally {
        setIsLoading(false);
      }
    }

    registerClient();
  }, []);

  return { clientId, user, isRegistered, isLoading, error };
}