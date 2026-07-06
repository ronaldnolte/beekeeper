import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Check, Layers, LocateFixed, MapPin, Search, Plus, Minus } from 'lucide-react';
import { searchPlaces, type GeocodeResult } from '../../data/geocoding';

interface Props {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

// Continental-US fallback when the apiary has no coordinates yet.
const DEFAULT_CENTER: [number, number] = [39.5, -98.35];
const DEFAULT_ZOOM = 4;
const PLACE_ZOOM = 15;

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

// Full-screen map to pick an apiary's coordinates. The pin is fixed at the
// screen center (a DOM overlay, not a Leaflet marker) and the map pans beneath
// it, so the map's center IS the chosen point. No location permission is used
// unless the user taps "locate me". Tiles: OpenStreetMap (free, no API key),
// with an Esri World Imagery satellite layer as a toggle.
export const ApiaryMapPicker: React.FC<Props> = ({ initialLat, initialLng, onConfirm, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const streetRef = useRef<L.TileLayer | null>(null);
  const satRef = useRef<L.TileLayer | null>(null);

  const hasInitial =
    initialLat != null && initialLng != null && !isNaN(initialLat) && !isNaN(initialLng);
  const [center, setCenter] = useState<[number, number]>(
    hasInitial ? [initialLat as number, initialLng as number] : DEFAULT_CENTER
  );
  const [isSatellite, setIsSatellite] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [results, setResults] = useState<GeocodeResult[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: hasInitial ? [initialLat as number, initialLng as number] : DEFAULT_CENTER,
      zoom: hasInitial ? PLACE_ZOOM : DEFAULT_ZOOM,
      zoomControl: false,
      // Calmer wheel zoom: 'center' keeps the fixed pin's target under the pin
      // while zooming, and a higher px-per-level stops one notch jumping several
      // levels (Leaflet's default of 60 over-reacts on many mice/trackpads).
      scrollWheelZoom: 'center',
      wheelPxPerZoomLevel: 140,
      wheelDebounceTime: 60,
    });
    mapRef.current = map;

    streetRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });
    satRef.current = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imagery &copy; Esri' }
    );
    streetRef.current.addTo(map);

    const sync = () => {
      const c = map.getCenter();
      setCenter([c.lat, c.lng]);
    };
    map.on('move', sync);
    // Dragging the map means the user is done with the search list.
    map.on('dragstart', () => setResults([]));

    // The modal animates in; make sure Leaflet measures the final size.
    const t = setTimeout(() => map.invalidateSize(), 120);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSatellite = () => {
    const map = mapRef.current;
    if (!map || !streetRef.current || !satRef.current) return;
    if (isSatellite) {
      satRef.current.remove();
      streetRef.current.addTo(map);
    } else {
      streetRef.current.remove();
      satRef.current.addTo(map);
    }
    setIsSatellite((v) => !v);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchMsg(null);
    setResults([]);
    try {
      const found = await searchPlaces(q);
      if (found.length === 0) {
        setSearchMsg(`No match for "${q}".`);
      } else if (found.length === 1) {
        pickResult(found[0]);
      } else {
        setResults(found);
      }
    } catch (err: any) {
      setSearchMsg(err.message || 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: GeocodeResult) => {
    mapRef.current?.setView([r.lat, r.lng], PLACE_ZOOM);
    setResults([]);
    setSearchMsg(null);
    setQuery(r.label);
  };

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const locateMe = () => {
    if (!('geolocation' in navigator)) {
      setLocateError('Location is not available on this device.');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], PLACE_ZOOM);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocateError('Could not get your location. You can still pick it on the map.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-black animate-in fade-in duration-200">
      {/* Map area */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0 bg-[var(--color-bg-raised)]" />

        {/* Top bar (floats over the map): close + place search */}
        <div className="absolute top-0 left-0 right-0 p-3 flex items-center gap-2 z-[1000]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map"
            className="shrink-0 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={20} className="text-[var(--color-text)]" />
          </button>
          <form
            onSubmit={handleSearch}
            className="flex-1 flex items-center gap-1.5 bg-white rounded-full shadow-md pl-3.5 pr-1.5 py-1.5"
          >
            <Search size={18} className="shrink-0 text-[var(--color-text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Address, zip, or place"
              enterKeyHint="search"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
            />
            <button
              type="submit"
              disabled={!query.trim() || searching}
              className="shrink-0 text-sm font-black text-[var(--color-primary)] px-3 py-1.5 rounded-full disabled:opacity-40 active:scale-95 transition-transform"
            >
              {searching ? '…' : 'Go'}
            </button>
          </form>
        </div>

        {searchMsg && (
          <div className="absolute top-[68px] left-3 right-3 z-[1000] bg-black/60 text-white text-xs font-medium px-3 py-2 rounded-lg">
            {searchMsg}
          </div>
        )}

        {results.length > 0 && (
          <div className="absolute top-[68px] left-3 right-3 z-[1001] bg-white rounded-2xl shadow-xl overflow-hidden max-h-[244px] overflow-y-auto custom-scrollbar">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickResult(r)}
                className="w-full flex items-start gap-2.5 text-left px-4 py-3 border-b border-[var(--color-card-border)] last:border-b-0 active:bg-black/5 transition-colors"
              >
                <MapPin size={16} className="shrink-0 mt-0.5 text-[var(--color-primary)]" />
                <span className="text-sm font-bold text-[var(--color-text)] leading-snug">{r.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Right-side controls */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-[1000]">
          {/* Precise +/- zoom (one level per tap) */}
          <div className="rounded-xl bg-white shadow-md overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={zoomIn}
              aria-label="Zoom in"
              className="w-11 h-11 flex items-center justify-center text-[var(--color-text)] active:bg-black/5 transition-colors"
            >
              <Plus size={20} />
            </button>
            <div className="h-px bg-[var(--color-card-border)]" />
            <button
              type="button"
              onClick={zoomOut}
              aria-label="Zoom out"
              className="w-11 h-11 flex items-center justify-center text-[var(--color-text)] active:bg-black/5 transition-colors"
            >
              <Minus size={20} />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleSatellite}
            aria-label="Toggle satellite view"
            aria-pressed={isSatellite}
            className={`w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform border-2 ${
              isSatellite ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text)]'
            }`}
          >
            <Layers size={21} />
          </button>
          <button
            type="button"
            onClick={locateMe}
            aria-label="Use my location"
            className="w-11 h-11 rounded-xl bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform text-[var(--color-text)]"
          >
            <LocateFixed size={21} className={locating ? 'animate-pulse text-[var(--color-primary)]' : ''} />
          </button>
        </div>

        {/* Drag hint */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[calc(50%-72px)] pointer-events-none z-[1000] bg-black/50 text-white text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap">
          Drag the map to move the pin
        </div>

        {/* Fixed center pin */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-black/30 pointer-events-none z-[1000]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1001]">
          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" style={{ boxShadow: '0 0 0 4px rgba(233,155,26,0.35)' }} />
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[1001] text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] border-[3px] border-white shadow-lg flex items-center justify-center">
            <MapPin size={25} className="text-white" />
          </div>
          <div
            className="mx-auto"
            style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '11px solid var(--color-primary)', marginTop: '-1px' }}
          />
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="bg-[var(--color-bg-raised)] px-5 pt-4 pb-6 shadow-[0_-6px_24px_rgba(0,0,0,0.16)]">
        {locateError && (
          <div className="mb-3 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {locateError}
          </div>
        )}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center text-[var(--color-primary)]">
            <MapPin size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Pin position</div>
            <div className="text-sm font-bold text-[var(--color-text)] tabular-nums">
              {round5(center[0]).toFixed(5)}, {round5(center[1]).toFixed(5)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onConfirm(round5(center[0]), round5(center[1]))}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white font-black py-4 rounded-xl shadow-lg shadow-[var(--color-primary)]/30 active:scale-[0.98] transition-transform"
        >
          <Check size={20} /> Confirm location
        </button>
      </div>
    </div>
  );
};
