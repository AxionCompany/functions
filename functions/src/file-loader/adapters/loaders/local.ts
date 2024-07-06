import getEnv from "../../../utils/environmentVariables.ts";

export default ({ config }: any) => {

  const readTextFile = async (path: string) => {
    try {
      const content = await Deno.readTextFile(path || "");
      const variables = getEnv();
      return ({ content, variables });
    } catch (_) {
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
      console.log('Error Reading Directory', err);
      return [];
    }
  }


  return {
    readTextFile,
    readDir,
  }
}
