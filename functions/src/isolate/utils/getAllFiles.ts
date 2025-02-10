// getAllFiles.ts
import getFile from "./getFile.ts";

interface GetAllFilesOptions {
  url: string;
  name: string;
  extensions: string[];
  returnProp?: string;
}

/**
 * Searches through URL path segments to find all possible file matches.
 *
 * @param options - The options for searching files.
 * @returns An array of file data objects.
 */
export default async function getAllFiles({
  url,
  name,
  extensions,
  returnProp,
}: GetAllFilesOptions): Promise<any[]> {
  const urlData = new URL(url);
  const possibleFileUrls: string[] = [];

  const pathSegments = urlData.pathname.split("/");
  for (let i = 0; i < pathSegments.length; i++) {
    const urlParts = pathSegments.slice(0, i + 1);
    urlParts.push(name);
    const newUrl = new URL(url);
    newUrl.pathname = urlParts.join("/");
    newUrl.search = urlData.search;
    possibleFileUrls.push(newUrl.href);
  }

  const files = (
    await Promise.all(
      possibleFileUrls.map((fileUrl) =>
        getFile(fileUrl, { ext: extensions, fileName: name }, returnProp).catch(() => null)
      )
    )
  ).filter(Boolean);
  
  return files;
}
