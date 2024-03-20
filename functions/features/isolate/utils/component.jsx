export default async (component) => {
  const { default: React } = await import("npm:react");
  const { hydrateRoot } = await import("npm:react-dom/client");

  // add a div in document with the id
  const domNode = document.getElementById(id);
  hydrateRoot(domNode, component);
};
