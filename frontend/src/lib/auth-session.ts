import { apiFetch } from './api.ts';
import type { User } from '../context/AuthContext.tsx';

let pendingSession: Promise<{ user: User | null }> | null = null;

export function loadInitialSession(): Promise<{ user: User | null }> {
  if (!pendingSession) {
    pendingSession = apiFetch<{ user: User | null }>('/api/auth/session').finally(() => {
      pendingSession = null;
    });
  }
  return pendingSession;
}
