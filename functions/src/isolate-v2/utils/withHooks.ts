import { Handler, OxianContext } from '../types.ts';


/**
 * Helper function to check if a value is a Promise (or thenable).
 */
function isPromise(value: any): value is Promise<any> {
    return value != null && typeof value.then === 'function';
}

/**
 * Defines the shape of the interceptor object.
 */
export type Interceptor = {
    beforeRun?: (data: Record<string, any>, context: OxianContext) => any;
    afterRun?: (data: Record<string, any>, context: OxianContext) => any;
};

/**
 * Wraps a handler function with before and after hooks, preserving sync/async behavior.
 * @param fn The main handler function to wrap.
 * @param interceptor An object containing optional beforeRun and afterRun hooks.
 * @returns A new handler function that incorporates the hooks.
 */
export function withHooks(
    fn: Handler,
    interceptor: Interceptor,
): Handler {
    const { beforeRun, afterRun } = interceptor;

    if (!beforeRun && !afterRun) {
        return fn;
    }

    return function wrappedFunction(data: Record<string, any>, context: OxianContext): any {
        context.executionId = crypto.randomUUID();
        context.name = fn.name;
       
        // Executes the main function and then the afterRun hook.
        function executeMain(currentData: Record<string, any>, context: OxianContext): any {
            const result = fn(currentData, context);

            if (isPromise(result)) {
                return result.then((resolvedResult: any) => {
                    return handleAfterHook(currentData, resolvedResult, context);
                });
            }
            return handleAfterHook(currentData, result, context);
        }

        // Executes the afterRun hook.
        function handleAfterHook(finalData: Record<string, any>, result: any, context: OxianContext): any {
            if (afterRun) {
                context.timestamp = Date.now();
                const afterRunResult = afterRun(result, context);
                
                if (isPromise(afterRunResult)) {
                    return afterRunResult.then((resolvedAfter: any) => {
                        return resolvedAfter !== undefined ? resolvedAfter : result;
                    });
                }
                
                return afterRunResult !== undefined ? afterRunResult : result;
            }
            return result;
        }

        // Starts the chain by executing the beforeRun hook.
        if (beforeRun) {
            context.timestamp = Date.now();
            const beforeResult = beforeRun(data, context);
            if (isPromise(beforeResult)) {
                return beforeResult.then((newData: any) => {
                    return executeMain(newData || data, context);
                });
            } else {
                return executeMain(beforeResult || data, context);
            }
        }

        // If no beforeRun hook, start with the main function.
        return executeMain(data, context);
    };
} 