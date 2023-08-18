import { importModule } from "https://esm.sh/gh/vfssantos/deno-dynamic-import/mod.ts";

export default 
async (props: {
  v: any;
  pathname: string;
  params: any;
  env:any;
}) => {
  // get props
  let { pathname, v, params, env } = props;
  // get env
  const { FILE_LOADER_URL, GIT_TOKEN } = env;
  // cache busting
  if (!v[pathname] || pathname.endsWith("/___cacheBust___")) {
    pathname = pathname.replace("/___cacheBust___", "");
    v[pathname] = Date.now();
  }
  // create url
  const url: URL = new URL(pathname, FILE_LOADER_URL);
  // add cache busting
  url.searchParams.set("v", v[pathname]);
  // add token
  if (GIT_TOKEN) url.searchParams.set("token", GIT_TOKEN);
  // import module
  const mod = await importModule(url.href);
  // run module
  const res = await mod?.default(params);
  // return response
  return res;
};
