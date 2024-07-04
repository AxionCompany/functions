
export default ({ config }: any) => {

  const readTextFile = async (path: string) => {
    try {
      return await Deno.readTextFile(path || "");
    } catch (err) {
      return null;
    }
  }

  const readDir = async (path: string) => {
    try {
      const files = [];
      for await (const dirEntry of Deno.readDir(path)) {
        files.push({
          name: dirEntry.name,
          isFile: dirEntry.isFile,
          isDirectory: dirEntry.isDirectory
        });
      }
      return files;
    } catch (err) {
      console.log('ERROR', err);
      return [];
    }
  }

  return {
    readTextFile,
    readDir

  }
}
