import { walk } from "https://deno.land/std@0.114.0/fs/mod.ts";

export default (modules) => async ({ pathname }) => {
  const dirPath = pathname.substring(0, pathname.lastIndexOf("/"));
  const baseFileName = pathname.substring(pathname.lastIndexOf("/") + 1);

  for await (const entry of walk(dirPath)) {
    if (entry.isFile && entry.name.startsWith(baseFileName)) {
      const content = await Deno.readTextFile(entry.path);
      return content
    }
  }
};
