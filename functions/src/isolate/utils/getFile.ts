// getFile.ts
interface GetFileOptions {
    ext?: string | string[];
    fileName?: string;
  }
  
  /**
   * Fetches a file from a URL and validates its metadata.
   *
   * @param url - The URL to fetch.
   * @param options - Options to validate file extension or filename.
   * @param returnProp - If provided, returns the specified property from the JSON.
   */
  export default async function getFile(
    url: string,
    options: GetFileOptions,
    returnProp?: string
  ): Promise<any> {
    const response = await fetch(url, {
      headers: { "content-type": "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    const data = await response.json();
    const matchPath: string = data.matchPath;
    if (options.ext) {
      const extension = matchPath.split(".").pop()?.split("?")[0];
      if (typeof options.ext === "string") {
        if (!extension?.includes(options.ext)) {
          throw new Error(`Matched file does not have .${options.ext} extension`);
        }
      } else if (Array.isArray(options.ext)) {
        if (!extension || !options.ext.includes(extension)) {
          throw new Error(`Matched file extension is not one of: ${options.ext.join(", ")}`);
        }
      }
    }
    if (options.fileName) {
      const fileNameFromPath = matchPath.split("/").pop()?.split("?")[0].split(".")[0];
      if (fileNameFromPath !== options.fileName) {
        throw new Error(`Matched file does not contain ${options.fileName} in its path`);
      }
    }
    return returnProp ? data[returnProp] : data;
  }
  