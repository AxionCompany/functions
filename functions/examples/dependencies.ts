import type { OxianConfig } from "../../api.ts";

/**
 * Dependencies are functions that run before a function is executed
 * They can be used to add dependencies to the isolate
 * They'll be accessible via the context object, via context.dependencies:
 *  - as second argument for default function types
 *  - as 'this' for 'bound' function types (to enable this, return 'isBoud' in dependencies.ts or shared.ts[shared file is deprecated])
 *  - as argument for 'factory' function types (to enable this, return 'isFactory' in dependencies.ts or shared.ts[shared file is deprecated])
 */

/**
 * Dependencies example
 * 
 * @param {Object} config - The config of the isolate
 * @returns {Object} - The config
 */
export default (config: OxianConfig) => {

    /**
     * This function will return the config
     * with the test property added
     * 
     * @returns {Object} - The config with the test property
     */
    return {
        ...config,
        test: 'test'
    }
}
