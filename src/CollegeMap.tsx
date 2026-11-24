import { divIcon } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import type { CollegeGeocodeLocation } from './api';
import 'leaflet/dist/leaflet.css';
import './CollegeMap.css';

const collegeIcon = divIcon({
  className: 'college-map-pin',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

type Props = {
  collegeName: string;
  location: CollegeGeocodeLocation;
};

export default function CollegeMap({ collegeName, location }: Props) {
  const position: [number, number] = [location.latitude, location.longitude];

  return (
    <div className="college-map-frame">
      <MapContainer
        key={`${location.latitude}:${location.longitude}`}
        center={position}
        zoom={14}
        scrollWheelZoom={false}
        className="college-leaflet-map"
        aria-label={`Approximate map location of ${collegeName}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={collegeIcon}>
          <Popup>
            <strong>{collegeName}</strong>
            <br />
            {location.name}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
