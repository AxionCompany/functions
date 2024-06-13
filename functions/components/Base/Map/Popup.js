import React from "react";

import { Popup as PopupLF } from "react-leaflet";

export default function Popup(props) {
  const { children } = props;
  return <PopupLF {...props}>{children}</PopupLF>;
}
