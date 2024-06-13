import L from "leaflet";
import { createControlComponent } from "@react-leaflet/core";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import "leaflet-control-geocoder/dist/Control.Geocoder.js";
import { useMap } from "react-leaflet";
import { useEffect } from "react";

const CreateRoutineMachineLayer = ({
  lineStyles,
  center,
  waypoints,
  isEditing,
  setRouteMachine = (props) => { },
}) => {
  lineStyles = lineStyles || { color: "red", weight: 4 }
  const map = useMap();
  let instance = null;

  useEffect(() => {
    setRouteMachine(instance);
  }, []);

  useEffect(() => {
    map.flyTo(center, 11);
  }, [center]);

  const createAllMarkers = (idx, wp, nWps) => {
    return L.marker(wp.latLng, { draggable: true });
  };

  const createStartAndEndMarkers = (idx, wp, nWps) => {
    if (idx === 0 || idx === nWps - 1) {
      return L.marker(wp.latLng);
    } else {
      return null;
    }
  };

  const options = {
    waypoints: waypoints.map((waypoint) => L.latLng(waypoint[0], waypoint[1])),
    lineOptions: {
      styles: [lineStyles],
    },
    show: true,
    addWaypoints: isEditing,
    draggableWaypoints: isEditing,
    createMarker: isEditing ? createAllMarkers : createStartAndEndMarkers,
  };

  instance = L.Routing.control(options);

  return instance;
};

const RoutingMachine = createControlComponent(CreateRoutineMachineLayer);

export default RoutingMachine;
