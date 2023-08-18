export default async ({ pathname, token, owner, repo }) => {

  const dirPath = pathname.substring(0, pathname.lastIndexOf("/"));
  const baseFileName = pathname.substring(pathname.lastIndexOf("/") + 1);

  const headers = new Headers();
  token && headers.append("Authorization", `Bearer ${token}`);
  headers.append("Accept", "application/vnd.github.v3.raw");
  try {
    const dirRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents${dirPath}`,
      { headers },
    );
    if (!dirRes.ok) {
      throw new Error(`HTTP error! status: ${dirRes.status}`);
    }
    const files = await dirRes.json();

    for (let file of files) {
      if (file.name.startsWith(baseFileName)) {
        const fileRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents${dirPath}/${file.name}`,
          { headers },
        );

        if (!fileRes.ok) {
          throw new Error(`HTTP error! status: ${fileRes.status}`);
        }

        const content = await fileRes.text();

        return content;
      }
    }
  } catch (error) {
    console.error(
      `There was a problem with the fetch operation: ${error.message}`,
    );
  }
};
