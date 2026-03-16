// file: hooks/useAuth.ts
// Authentication hook: verify token, connect, disconnect.
// Wraps storageApi.verifyToken with TanStack Query mutation.
// Used by: ConnectPage.tsx, AppLayout.tsx (guard).
// On success, stores credentials in connection store.

import { useMutation, useQuery } from '@tanstack/react-query';
import { useConnectionStore } from '@/stores/connection';
import { storageApi } from '@/api/storage';

export function useVerifyToken() {
  return useMutation({
    mutationFn: async ({ stackUrl, token }: { stackUrl: string; token: string }) => {
      const normalized = stackUrl.replace(/\/+$/, '');
      return storageApi.verifyToken(normalized, token);
    },
  });
}

export function useTokenInfo() {
  const { stackUrl, token, isConnected } = useConnectionStore();

  return useQuery({
    queryKey: ['token', 'verify'],
    queryFn: () => storageApi.verifyToken(stackUrl, token),
    enabled: isConnected,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConnect() {
  const connect = useConnectionStore((s) => s.connect);
  const verify = useVerifyToken();

  return {
    ...verify,
    connect: async (stackUrl: string, token: string) => {
      const normalized = stackUrl.replace(/\/+$/, '');
      const result = await verify.mutateAsync({ stackUrl: normalized, token });
      connect(normalized, token, result.owner.name, result.description);
      return result;
    },
  };
}

export function useDisconnect() {
  return useConnectionStore((s) => s.disconnect);
}
