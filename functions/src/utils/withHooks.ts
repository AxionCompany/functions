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

    // Keep original validations
    if (typeof fn !== 'function') {
        throw new TypeError('The first argument "fn" must be a function.');
    }
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
        
        // Only run hooks if they exist and we have a requestId
        const willUseHooks = (options?.before || options?.after) && __requestId__;

        // Run before hook if applicable
        if (willUseHooks && options?.before) {
            try {
                const beforeResult = options.before.call(self, {
                    input: args,
                    name,
                    timestamp: startTime,
                    executionId,
                    requestId: __requestId__,
                    status: 'started',
                    properties: self || { empty: true }
                });

                if (isPromise(beforeResult)) {
                    return beforeResult.then(() => executeMain()).catch(err => {
                        console.error('Error in before hook:', err);
                        throw err;
                    });
                }
            } catch (err) {
                console.error('Error in before hook:', err);
                throw err;
            }
        }

        return executeMain();

        function executeMain(): T | Promise<T> {
            let result: T;
            try {
                result = fn.apply(self, args);
            } catch (err) {
                handleAfterHook(err as T, 'error');
                throw err;
            }

            if (isPromise(result)) {
                return result
                    .then(resolved => handleAfterHook(resolved, 'completed'))
                    .catch(err => {
                        handleAfterHook(err, 'error');
                        throw err;
                    });
            }

            return handleAfterHook(result, 'completed');
        }

        function handleAfterHook(output: T, status: 'completed' | 'error'): T | Promise<T> {
            if (!willUseHooks || !options?.after) {
                return output;
            }

            try {
                const duration = Date.now() - startTime;
                const afterResult = options.after.call(self, {
                    output,
                    input: args,
                    name,
                    timestamp: Date.now(),
                    executionId,
                    requestId: __requestId__,
                    status,
                    duration,
                    properties: { ...(self || {}), ...((output as any)?.__tags__ || {}) }
                });

                if (isPromise(afterResult)) {
                    return afterResult.then(() => output);
                }
            } catch (err) {
                console.error('Error in after hook:', err);
                throw err;
            }

            return output;
        }
    };
}
