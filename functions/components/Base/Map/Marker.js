
import { Marker as MarkerLF } from "react-leaflet";
import L from "leaflet";

export default function Marker(props) {
  const { iconUrl, iconSize, iconAnchor } = props;
  if (iconUrl && iconSize && iconAnchor) {
    return (
      <MarkerLF
        icon={new L.Icon({
          iconUrl: iconUrl,
          iconSize: new L.Point(iconSize[0], iconSize[1]),
          iconAnchor: new L.Point(iconAnchor[0], iconAnchor[1])
        })}
        {...props}
      />
    );
  }
  return <MarkerLF {...props} />;
}
