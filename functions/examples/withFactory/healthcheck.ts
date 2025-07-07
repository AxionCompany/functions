import type { OxianContext } from "../../src/isolate-v2/types.ts";

export default (ctx: OxianContext) => {
    return function healthCheck(data: any) {
        return {
            data: data,
            ctx: Object.keys(ctx)
        }

    }
}

