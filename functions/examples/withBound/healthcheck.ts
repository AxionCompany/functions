import type { OxianContext } from "../../src/isolate-v2/types.ts";

export default function healthCheck(this: OxianContext, data: any) {
    const ctx = { ...this }
    return {
        data: data,
        ctx: Object.keys(ctx)
    }
}
