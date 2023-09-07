// UNCOMMENT BELOW FOR DENO VERSION
// import { walk } from "https://deno.land/std@0.114.0/fs/mod.ts";

// export default ({ config }) => async ({ pathname }) => {

//   if (config?.functionsDir) pathname = `${config.functionsDir}${pathname}`;

//   let dirPath;
//   let baseFileName;

//   const fileInfo = await Deno.stat(pathname)
//     .then((res) => res)
//     .catch((err) => {
//       return { isDirectory: false };
//     });
//   if (fileInfo.isDirectory) { // check if pathname is a directory
//     dirPath = pathname;
//     baseFileName = config?.dirEntrypoint || "index";
//   } else {
//     dirPath = pathname.substring(0, pathname.lastIndexOf("/"));
//     baseFileName = pathname.substring(pathname.lastIndexOf("/") + 1);
//   }

//   for await (const entry of walk(dirPath)) {
//     if (entry.isFile && entry.name.startsWith(baseFileName)) {
//       const content = await Deno.readTextFile(entry.path);
//       return content;
//     }
//   }
// };




// NODE.JS COMPATIBLE VERSION
import { readdir, readFile, stat } from "node:fs/promises"
import { join, basename } from "node:path"

async function walk(dir) {
  let files = await readdir(dir)
  files = await Promise.all(
    files.map(async (file) => {
      const filePath = join(dir, file)
      const stats = await stat(filePath)
      if (stats.isDirectory()) return walk(filePath)
      else if (stats.isFile()) return filePath
    })
  )

  return files.reduce((all, folderContents) => all.concat(folderContents), [])
}

export default function ({ config }) {
  return async function({ pathname }) {
    const isFile = pathname.includes('.')

    if (config?.functionsDir) pathname = `${config.functionsDir}${pathname}`
    let dirPath
    let baseFileName
    let isDirectory
    try {
      isDirectory = (await stat(pathname)).isDirectory()
    } catch (error) {
      isDirectory = false
    }
    if (isDirectory) {
      dirPath = pathname
      baseFileName = config?.dirEntrypoint || 'index'
    } else {
      dirPath = pathname.substring(0, pathname.lastIndexOf('/'))
      baseFileName = pathname.substring(pathname.lastIndexOf('/') + 1)
    }
    const files = await walk(dirPath)
    for (const filePath of files) {
      if (basename(filePath).startsWith(baseFileName)) {
        const content = await readFile(filePath, 'utf-8');
        if (!isFile) {
          return {
            redirect: `${dirPath.slice(config?.functionsDir?.length || 0)}/${basename(filePath)}`
          }
        }
        return {content, filename: filePath}
      }
    }
  }
}