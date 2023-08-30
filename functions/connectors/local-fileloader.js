import { walk } from "https://deno.land/std@0.114.0/fs/mod.ts";

export default ({ config }) => async ({ pathname }) => {
  if (config?.functionsDir) pathname = `${config.functionsDir}/${pathname}`;

  let dirPath;
  let baseFileName;

  console.log(pathname)

  const fileInfo = await Deno.stat(pathname)
    .then((res) => res)
    .catch((err) => {
      return { isDirectory: false };
    });
  if (fileInfo.isDirectory) { // check if pathname is a directory
    dirPath = pathname;
    baseFileName = config?.dirEntrypoint || "index";
  } else {
    dirPath = pathname.substring(0, pathname.lastIndexOf("/"));
    baseFileName = pathname.substring(pathname.lastIndexOf("/") + 1);
  }

  for await (const entry of walk(dirPath)) {
    if (entry.isFile && entry.name.startsWith(baseFileName)) {
      const content = await Deno.readTextFile(entry.path);
      return content;
    }
  }
};
