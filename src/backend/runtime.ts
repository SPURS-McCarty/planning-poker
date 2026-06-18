import { MockPlanningPokerApi } from './mockPlanningPokerApi';
import { PlanningPokerHttpApi } from './httpPlanningPokerApi';
import type { PlanningPokerApi } from './planningPokerApi';

export type BackendMode = 'legacy' | 'mock' | 'http';

const configuredMode = (import.meta.env.VITE_BACKEND_MODE as string | undefined)?.toLowerCase();
export const backendMode: BackendMode =
  configuredMode === 'mock' || configuredMode === 'http' ? configuredMode : 'legacy';

const httpBaseUrl = import.meta.env.VITE_PLANNING_POKER_API_BASE_URL as string | undefined;

function getHttpToken(): Promise<string> {
  const token = (window as Window & { __PLANNING_POKER_TOKEN__?: string }).__PLANNING_POKER_TOKEN__;
  if (!token) {
    return Promise.reject(new Error('Missing __PLANNING_POKER_TOKEN__ for HTTP backend mode'));
  }
  return Promise.resolve(token);
}

let api: PlanningPokerApi | null = null;

if (backendMode === 'mock') {
  api = new MockPlanningPokerApi();
} else if (backendMode === 'http' && httpBaseUrl) {
  api = new PlanningPokerHttpApi(httpBaseUrl, getHttpToken);
}

export const planningPokerApi = api;
export const hasApiBackend = Boolean(api);
