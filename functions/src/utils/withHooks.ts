/**
 * Helper function to check if a value is a Promise (or thenable).
 * @param value - The value to check.
 * @returns True if the value has a then method.
 */
function isPromise(value: any): value is Promise<any> {
    return value != null && typeof value.then === 'function';
}

type HookContext<A> = {
    input: A;
    name: string;
    timestamp: number;
    executionId: string;
    requestId: string;
    status: 'started' | 'completed' | 'error';
    duration?: number; // Only present in after hook
    properties?: Record<string, any>;
};

/**
 * Options for the hooks.
 */
type HookOptions<T, A extends any[]> = {
    /**
     * A hook to run before the main function.
     * Can be synchronous or asynchronous.
     */
    before?: (context: HookContext<A>) => any;
    /**
     * A hook to run after the main function.
     * Receives the main function's result as its first argument.
     * Can be synchronous or asynchronous.
     */
    after?: (context: HookContext<A> & { output: T }) => any;
};

/**
 * Higher-order function that wraps a given function with before and after hooks.
 * It preserves the original function's synchronous or asynchronous nature.
 *
 * @param fn - The main function to wrap.
 * @param options - An object containing optional before and after hooks.
 *
 * @returns A new function that, when called, runs the before hook (if provided),
 * then the main function, and finally the after hook (if provided). If any hook
 * or the main function returns a Promise, the overall result will be a Promise.
 *
 * @throws {TypeError} If `fn` or any provided hook is not a function.
 */
export function withHooks<T, A extends any[]>(
    this: Record<string, any>,
    fn: (...args: A) => T,
    options?: HookOptions<T, A>
): (...args: A) => T | Promise<T> {

    const { __requestId__ } = this;
    // Validate the main function
    if (typeof fn !== 'function') {
        throw new TypeError('The first argument "fn" must be a function.');
    }
    // Validate hooks if provided
    if (options?.before && typeof options.before !== 'function') {
        throw new TypeError('The "before" hook must be a function if provided.');
    }
    if (options?.after && typeof options.after !== 'function') {
        throw new TypeError('The "after" hook must be a function if provided.');
    }

    return function wrappedFunction(this: any, ...args: A): T | Promise<T> {
        const self = this;
        const name = fn.name.split('bound ').filter(Boolean)[0] || 'anonymous';
        const executionId = crypto.randomUUID();
        const startTime = Date.now();
        const requestId = __requestId__;

        /**
         * Helper to execute the after hook, if provided.
         * @param result - The result from the main function.
         * @param status - The status of the execution.
         * @returns The original result or a Promise resolving to that result.
         */
        function callAfterHook(result: T, status: 'completed' | 'error' = 'completed'): T | Promise<T> {
            try {
                const timestamp = Date.now();
                const duration = timestamp - startTime;

                const maybeAfter = options?.after?.call(self, {
                    output: result,
                    input: args,
                    name,
                    timestamp,
                    executionId,
                    requestId,
                    status,
                    duration,
                    properties: {...(this || {}), ...((result as any)?.__tags__ || {})}
                });
                if (isPromise(maybeAfter)) {
                    return maybeAfter.then(() => result).catch((err: any) => {
                        console.error('Error in after hook:', err);
                        throw err;
                    });
                } else {
                    return result;
                }
            } catch (err) {
                console.error('Error in after hook:', err);
                throw err;
            }
        }

        /**
         * Executes the main function and then the after hook.
         * @returns The result from the main function (possibly wrapped in a Promise).
         */
        function callMain(): T | Promise<T> {
            let result: T;
            try {
                result = fn.apply(self, args);
            } catch (err) {
                console.error('Error in main function:', err);
                return callAfterHook(err as T, 'error');
            }
            if (isPromise(result)) {
                // The main function is asynchronous.
                return result
                    .then((resolved: T) => callAfterHook(resolved, 'completed'))
                    .catch((err: any) => {
                        console.error('Error in main function promise:', err);
                        return callAfterHook(err, 'error');
                    });
            } else {
                // The main function is synchronous.
                return callAfterHook(result, 'completed');
            }
        }

        try {
            // Execute the before hook if provided.
            const maybeBefore = options?.before?.call(self, {
                input: args,
                name,
                timestamp: startTime,
                executionId,
                requestId,
                status: 'started',
                properties: this || {"empty": true}
            });
            if (isPromise(maybeBefore)) {
                // If the before hook is asynchronous, chain the call to the main function.
                return maybeBefore
                    .then(() => callMain())
                    .catch((err: any) => {
                        console.error('Error in before hook:', err);
                        throw err;
                    });
            } else {
                // Otherwise, continue synchronously.
                return callMain();
            }
        } catch (err) {
            console.error('Error in before hook:', err);
            throw err;
        }
    };
}
