import { lazy, Suspense, useState } from 'react';
import { api, type CollegeGeocodeLocation, type CollegeMatch } from './api';

const CollegeMap = lazy(() => import('./CollegeMap'));
const geocodeCache = new Map<string, CollegeGeocodeLocation[]>();
let lastGeocodeAt = 0;

type Props = {
  matches: CollegeMatch[];
};

export default function CollegeResults({ matches }: Props) {
  const isDemo = matches.some(match => match.is_demo);
  const [mapTarget, setMapTarget] = useState('');
  const [mapLocations, setMapLocations] = useState<CollegeGeocodeLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState(0);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapNote, setMapNote] = useState('');

  const showMap = async (match: CollegeMatch) => {
    if (mapBusy) return;
    const region = match.state === 'All India' ? 'India' : match.state;
    const query = `${match.college_name}, ${region}`;
    const cacheKey = query.toLocaleLowerCase();
    setMapTarget(match.college_name);
    setMapLocations([]);
    setSelectedLocation(0);
    setMapError('');
    setMapNote('');
    setMapBusy(true);

    try {
      let locations = geocodeCache.get(cacheKey);
      if (!locations) {
        const delay = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
        if (delay > 0) {
          await new Promise(resolve => window.setTimeout(resolve, delay));
        }
        lastGeocodeAt = Date.now();
        const result = await api.geocodeCollege(query);
        locations = result.results;
        geocodeCache.set(cacheKey, locations);
        setMapNote(result.disclaimer);
      } else {
        setMapNote('Map coordinates are cached for this browser session and are approximate.');
      }

      if (locations.length === 0) {
        setMapError('No matching map location was found. Try the college name again later.');
        return;
      }
      setMapLocations(locations);
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'The map location could not be loaded.');
    } finally {
      setMapBusy(false);
    }
  };

  const activeLocation = mapLocations[selectedLocation];

  return (
    <>
      <div className="college-match-list">
        <h3>{isDemo ? 'NEET college references' : 'Historical cutoff records'}</h3>
        {matches.map((match, index) => (
          <article key={`${match.college_name}-${match.course}-${match.round}-${index}`}>
            <div>
              {match.is_demo && <span className="demo-chip">REFERENCE MODEL · VERIFY WITH MCC</span>}
              <strong>{match.college_name}</strong>
              <span>{match.course} · {match.state}</span>
              <small>
                {match.is_demo
                  ? `Reference data · ${match.category} · ${match.quota}`
                  : `${match.year} · ${match.category} · ${match.quota} · Round ${match.round}`}
              </small>
            </div>
            <div className="college-rank">
              <b>
                {match.is_demo
                  ? match.demo_rank_reference?.toLocaleString('en-IN')
                  : match.historical_closing_rank?.toLocaleString('en-IN')}
              </b>
              <small>{match.is_demo ? 'Reference rank' : 'Historical closing rank'}</small>
              <span className={`advisory-band band-${match.advisory_band?.toLowerCase() || 'unknown'}`}>
                {match.is_demo ? 'Reference only · verify with MCC' : `${match.advisory_band || 'Historical match'} · advisory`}
              </span>
            </div>
            <div className="college-result-actions">
              <button
                type="button"
                className="text-link"
                onClick={() => void showMap(match)}
                disabled={mapBusy}
              >
                {mapBusy && mapTarget === match.college_name ? 'Locating…' : 'View map'}
              </button>
              {match.source_url && <a href={match.source_url} target="_blank" rel="noreferrer">Source ↗</a>}
              {match.is_demo && <small>Source: MCC verification required</small>}
            </div>
          </article>
        ))}
      </div>
      {mapTarget && (
        <section className="college-map-panel" aria-live="polite">
          <div className="college-map-heading">
            <h3>Approximate map location</h3>
            <strong>{mapTarget}</strong>
          </div>
          {mapBusy && <p role="status">Finding a location…</p>}
          {mapError && <p className="college-map-error" role="alert">{mapError}</p>}
          {mapNote && <p className="college-map-note">{mapNote}</p>}
          {mapLocations.length > 1 && (
            <label className="college-map-choice">
              Choose a matching location
              <select
                value={selectedLocation}
                onChange={event => setSelectedLocation(Number(event.target.value))}
              >
                {mapLocations.map((location, index) => (
                  <option value={index} key={`${location.latitude}-${location.longitude}`}>
                    {location.name}{location.type ? ` (${location.type})` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {activeLocation && (
            <Suspense fallback={<p role="status">Loading map…</p>}>
              <CollegeMap collegeName={mapTarget} location={activeLocation} />
            </Suspense>
          )}
          <small>Map locations are approximate, not verified campus addresses or travel routes.</small>
        </section>
      )}
    </>
  );
}
