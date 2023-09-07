import { lookup } from "https://esm.sh/mime-types";

export default ({ config } = {}) => async ({ filename }) => {
  const ext = "." + filename.split(".").pop();
  const mimetype = await (config.lookup(ext) || lookup(ext));
  return mimetype;
};
