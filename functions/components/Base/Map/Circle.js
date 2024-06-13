import React, { useEffect } from 'react';

import { Circle as CircleLF, useMap } from 'react-leaflet';

export default function Circle(props) {
  const map = useMap();

  useEffect(() => {
    if (!!props.zoom) {
      map.flyTo(props.center, props.zoom);
    }
  }, [props.center]);

  return <CircleLF {...props} />;
}
