import {
  DOMParser,
  initParser,
} from "https://deno.land/x/deno_dom/deno-dom-wasm-noinit.ts";

export default async (config: any) => {
  await initParser();
  return (html: string) => {
    // initialize when you need it, but not at the top level
    const doc = new DOMParser().parseFromString(
      html, "text/html"
    );
    return doc;
  };
};
