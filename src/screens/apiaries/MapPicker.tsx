// Full-screen map coordinate picker — SPEC B §7 (screenshot B20). Loaded only when opened.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Layers, LocateFixed, MapPin, Minus, Plus, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiBase } from '../../lib/platform';
import { Overlay } from '../../components/Overlay';

const SATELLITE = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery © Esri' };
const STREET = { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' };

interface Result {
  lat: number;
  lng: number;
  label: string;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

export default function MapPicker({ initial, onConfirm, onClose }: { initial: { lat: number; lng: number } | null; onConfirm: (lat: number, lng: number) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const [satellite, setSatellite] = useState(true); // the pin should land on the hive stand
  const [centre, setCentre] = useState(initial ?? { lat: 39.5, lng: -98.35 });
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, {
      center: initial ? [initial.lat, initial.lng] : [39.5, -98.35],
      zoom: initial ? 15 : 4,
      zoomControl: false,
      maxZoom: 19,
      scrollWheelZoom: 'center',
      wheelPxPerZoomLevel: 140, // one notch must not jump several levels
      wheelDebounceTime: 60,
    });
    map.current = m;
    const update = () => {
      const c = m.getCenter();
      setCentre({ lat: c.lat, lng: c.lng });
    };
    m.on('move', update);
    m.on('dragstart', () => setResults([])); // dragging the map closes the list
    // Measure again once the opening animation has settled.
    const t = setTimeout(() => m.invalidateSize(), 120);
    return () => {
      clearTimeout(t);
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    tiles.current?.remove();
    const src = satellite ? SATELLITE : STREET;
    tiles.current = L.tileLayer(src.url, { attribution: src.attribution, maxZoom: 19 }).addTo(m);
  }, [satellite]);

  const flyTo = (r: Result) => {
    map.current?.flyTo([r.lat, r.lng], 15);
    setQ(r.label);
    setResults([]);
  };

  const search = async (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    setMessage(null);
    setResults([]);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${apiBase()}/api/geocode?q=${encodeURIComponent(term)}`, {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401) return setMessage('Please sign in to search.');
      if (!res.ok) return setMessage(`Search failed (${res.status}).`);
      const { results: found } = (await res.json()) as { results: Result[] };
      if (found.length === 0) setMessage(`No match for "${term}".`);
      else if (found.length === 1) flyTo(found[0]);
      else setResults(found);
    } catch (err) {
      setMessage((err as Error).name === 'TimeoutError' ? 'Search timed out. Please check your connection.' : 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const locate = () => {
    if (!('geolocation' in navigator)) return setMessage('Location is not available on this device.');
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        map.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 17);
      },
      () => {
        setLocating(false);
        setMessage('Could not get your location. You can still pick it on the map.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const control = 'w-11 h-11 flex items-center justify-center bg-white text-text';

  return (
    <Overlay>
    <div className="fixed inset-0 z-[150] flex flex-col bg-white animate-fade-quick" role="dialog" aria-modal="true" aria-label="Pick apiary location">
      <div className="relative flex-1">
        <div ref={box} className="absolute inset-0" />

        {/* Fixed pin at the centre; the map moves under it. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full flex flex-col items-center">
          <span className="mb-1 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">Drag the map to move the pin</span>
          <span className="w-12 h-12 rounded-full bg-primary border-[3px] border-white shadow-lg flex items-center justify-center text-white">
            <MapPin size={22} />
          </span>
          <span className="w-2 h-3 bg-primary rounded-b-full -mt-0.5" />
        </div>

        <div className="absolute inset-x-3 z-[600] flex gap-2" style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <button type="button" onClick={onClose} aria-label="Close map" className="w-11 h-11 shrink-0 rounded-full bg-white shadow-md flex items-center justify-center text-text">
            <X size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <form onSubmit={search} className="flex items-center h-11 rounded-full bg-white shadow-md pl-4 pr-2 gap-2">
              <Search size={18} className="text-text-muted shrink-0" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Address, zip, or place" aria-label="Search" className="flex-1 min-w-0 bg-transparent font-bold outline-none placeholder:text-text-muted" />
              <button type="submit" disabled={!q.trim() || searching} className="px-2 font-black text-primary disabled:opacity-40">
                {searching ? '…' : 'Go'}
              </button>
            </form>
            {results.length > 1 && (
              <ul className="mt-2 max-h-[244px] overflow-y-auto rounded-2xl bg-white shadow-lg">
                {results.map(r => (
                  <li key={`${r.lat},${r.lng}`}>
                    <button type="button" onClick={() => flyTo(r)} className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm border-b border-divider last:border-b-0">
                      <MapPin size={16} className="shrink-0 text-primary" /> {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="absolute right-3 top-1/2 z-[600] -translate-y-1/2 flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden shadow-md">
            <button type="button" onClick={() => map.current?.zoomIn(1)} aria-label="Zoom in" className={control}>
              <Plus size={20} />
            </button>
            <button type="button" onClick={() => map.current?.zoomOut(1)} aria-label="Zoom out" className={`${control} border-t border-divider`}>
              <Minus size={20} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSatellite(s => !s)}
            aria-label="Toggle satellite view"
            aria-pressed={satellite}
            className={`${control} rounded-2xl shadow-md border-2 ${satellite ? 'border-primary text-primary' : 'border-transparent'}`}
          >
            <Layers size={20} />
          </button>
          <button type="button" onClick={locate} aria-label="Use my location" className={`${control} rounded-2xl shadow-md ${locating ? 'animate-pulse' : ''}`}>
            <LocateFixed size={20} />
          </button>
        </div>
      </div>

      <div className="shrink-0 bg-white px-5 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        {message && <p className="mb-3 rounded-xl bg-primary-wash px-3 py-2 text-sm font-bold text-primary-ink">{message}</p>}
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary-wash text-primary flex items-center justify-center">
            <MapPin size={18} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-text-muted">Pin position</p>
            <p className="font-black text-text tabular-nums">
              {centre.lat.toFixed(5)}, {centre.lng.toFixed(5)}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => onConfirm(round5(centre.lat), round5(centre.lng))} className="mt-4 w-full h-14 rounded-2xl bg-primary text-white text-lg font-black shadow-md flex items-center justify-center gap-2">
          <Check size={22} /> Confirm location
        </button>
      </div>
    </div>
    </Overlay>
  );
}
