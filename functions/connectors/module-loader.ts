import { importModule } from "https://raw.githubusercontent.com/vfssantos/deno-dynamic-import/main/mod.ts";

export default ({ config }: any) =>
async (props: {
  v?: any;
  pathname: string;
  token?: string;
  username?: string;
  password?: string;
}) => {
  // get props
  let { pathname, v } = props;
  const { loaderUrl } = config;

  // get env
  const username = config.username || props.username;
  const password = config.password || props.password;

  // cache busting
  if (v && !v[pathname] || pathname.endsWith("/___cacheBust___")) {
    pathname = pathname.replace("/___cacheBust___", "");
    v[pathname] = Date.now();
  }
  // create url
  const url: URL = new URL(pathname, loaderUrl);
  // add cache busting
  if (v) url.searchParams.set("v", v[pathname]);
  // add auth
  if (username) url.username = username
  if (password) url.password = password
  // import module
  console.log(`Loading ${url.href}`);
  const mod = await importModule(url.href);
  // return module
  return mod;
};
