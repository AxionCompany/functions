export default ({ config }) =>
  async function githubFileLoader({ pathname }) {
    const isFile = pathname.includes(".");

    const { token, owner, repo, functionsDir } = config;
    if (functionsDir) pathname = functionsDir + pathname;
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
      let files = await dirRes.json();
      for (let file of files) {
        if (file.name.startsWith(baseFileName)) {
          if (file.type === "dir") {
            const content = await githubFileLoader({
              pathname: `${pathname.slice(functionsDir?.length || 0)}/${
                config?.dirEntrypoint || "index"
              }`,
            });
            return content;
          }

          if (!isFile) {
            return {
              redirect: `${
                dirPath.slice(functionsDir?.length || 0)
              }/${file.name}`,
            };
          }
    
          const fileRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents${dirPath}/${file.name}`,
            { headers },
          );
    
          if (!fileRes.ok) {
            throw new Error(`HTTP error! status: ${file.status}`);
          }
    
          const content = await fileRes.text();
    
          return { type: "content", content, filename: file.name };
        }
      }

     
    } catch (error) {
      console.error(
        `There was a problem with the fetch operation: ${error.message}`,
      );
    }
  };
