import type { OxianConfig } from "../../../api.ts";

export default (config: OxianConfig) => {
    return { ...config, isBound: true }
}
