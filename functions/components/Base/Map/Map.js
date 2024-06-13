import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { MapContainer, TileLayer } from "react-leaflet";

const Map = ({
  children,
  center = [-23.55, -46.60],
  zoom = 6,
  scrollWheelZoom = true,
  doubleClickZoom = true,
}) => {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={scrollWheelZoom}
      doubleClickZoom={doubleClickZoom}
      preferCanvas={true}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {children}
    </MapContainer>
  );
};

export default Map;
