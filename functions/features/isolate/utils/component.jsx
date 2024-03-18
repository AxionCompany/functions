import React from 'https://esm.sh/react';
import { hydrateRoot } from 'https://esm.sh/react-dom/client';


export default ({ id, component }) => {
  // add a div in document with the id
  document.body
    .appendChild(document.createElement("div"))
    .setAttribute("id", id);
  const domNode = document.getElementById(id);
  hydrateRoot(domNode, component);
};
