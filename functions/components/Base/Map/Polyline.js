import { Polyline as PolylineLF, useMap } from "react-leaflet";
import 'leaflet-arrowheads';
const { useEffect } = React;
export default function Polyline(props) {
  let polylineRef;
  const map = useMap();
  useEffect(() => {
    if (!props.disableFlyTo) {
      map.flyTo(props.center, 12);
    }
  }, [props.center])

  useEffect(() => {
    const polylineDom = polylineRef
    if (props.arrowheads) {
      polylineDom.arrowheads(props.arrowheads)
      polylineDom._update()
    }
  }, [props.arrowheads])

  return <PolylineLF {...props} ref={ref => polylineRef = ref} />;
}
