// Nectar Flow request and response — SPEC C §3.3, SPEC D §2.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, type Apiary } from '../../lib/supabase';
import { apiBase } from '../../lib/platform';
import { anySignal, resolveApiaryCoords } from '../../lib/location';
import type { HistoryPoint } from '../../../shared/nectar/chart';

export type Phase = 'DEARTH' | 'TRENDING_UP' | 'IN_FLOW' | 'TRENDING_DOWN';

export interface NectarResponse {
  nfi: number;
  phase: Phase;
  status: string;
  trend_direction: 'rising' | 'falling' | 'flat';
  slope: number;
  v2: { greenness: number; vigor: number; moisture: number; warmth: number; fall_term: number; rate_norm: number };
  full_history: HistoryPoint[];
  satellite?: { last_pass: string | null; last_image: string | null; next_pass: string | null; pass_count: number; image_count: number };
  _timing?: Record<string, number>;
}

export type NectarState =
  | { kind: 'idle' }
  | { kind: 'loading'; startedAt: number }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; data: NectarResponse; coords: { lat: number; lng: number } };

const TIMEOUT_MS = 60_000;

/** Loads the index for one apiary; changing apiary/year or unmounting cancels the request. */
export function useNectar(apiary: Apiary | null, reviewYear: number | null) {
  const [state, setState] = useState<NectarState>({ kind: 'idle' });
  const current = useRef<AbortController | null>(null);

  const load = useCallback(
    async (bypassCache: boolean) => {
      current.current?.abort();
      if (!apiary) return setState({ kind: 'idle' });
      const ctl = new AbortController();
      current.current = ctl;
      const startedAt = Date.now();
      setState({ kind: 'loading', startedAt });

      try {
        const tCoords = Date.now();
        let coords: { lat: number; lng: number };
        try {
          coords = await resolveApiaryCoords(apiary, ctl.signal);
        } catch (err) {
          if (ctl.signal.aborted) return;
          const msg = (err as Error).message;
          // Missing location reads as the (sic) message the screen has always shown.
          throw new Error(msg.startsWith('Apiary has no location') ? "This apiary's coordinates are missing. Please edit the apiary first." : msg);
        }
        const coordMs = Date.now() - tCoords;

        const params = new URLSearchParams({ lat: coords.lat.toFixed(4), lng: coords.lng.toFixed(4) });
        if (bypassCache) params.set('nocache', String(Date.now()));
        else params.set('_d', new Date().toISOString().slice(0, 10)); // per-day cache key (UTC)
        if (reviewYear) params.set('year', String(reviewYear));

        const { data: session } = await supabase.auth.getSession();
        const timeout = AbortSignal.timeout(TIMEOUT_MS);
        const tRequest = Date.now();
        let res: Response;
        try {
          res = await fetch(`${apiBase()}/api/nectar-index-v2?${params}`, {
            headers: { Authorization: `Bearer ${session.session?.access_token ?? ''}` },
            signal: anySignal([ctl.signal, timeout]),
          });
        } catch (err) {
          if (ctl.signal.aborted) return; // abandoned: never an error, never overwrites newer data
          if (timeout.aborted) throw new Error('Request timed out. Earth Engine can take up to 60s.');
          throw err;
        }
        if (!res.ok) {
          // The server's plain-text "update the app" message is designed to be shown as-is.
          const text = await res.text().catch(() => '');
          throw new Error(text || `API error ${res.status}`);
        }
        const data = (await res.json()) as NectarResponse;
        if (ctl.signal.aborted) return;
        console.log('[nectar timing]', { coordinate_lookup_ms: coordMs, round_trip_ms: Date.now() - tRequest, server: data._timing });
        setState({ kind: 'loaded', data, coords });
      } catch (err) {
        if (ctl.signal.aborted) return;
        setState({ kind: 'error', message: (err as Error).message });
      }
    },
    [apiary, reviewYear],
  );

  useEffect(() => {
    void load(false);
    return () => current.current?.abort();
  }, [load]);

  return { state, reload: () => load(true) };
}

/**
 * The direction shown beside the phase. Deliberate change #18 (Ron, 2026-09-29): the server's
 * trend_direction uses an 11-day slope while the phase uses 5 days, so the live app could say
 * "Trending Up" next to "falling". A trending phase now sets the direction; otherwise the
 * server's value is shown. The response itself is unchanged (old phone builds read it).
 */
export function shownDirection(d: Pick<NectarResponse, 'phase' | 'trend_direction'>): 'rising' | 'falling' | 'flat' {
  if (d.phase === 'TRENDING_UP') return 'rising';
  if (d.phase === 'TRENDING_DOWN') return 'falling';
  return d.trend_direction;
}
