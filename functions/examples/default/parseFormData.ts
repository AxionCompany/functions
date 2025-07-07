/**
 * This is a function that will be called when the user calls /examples/default/parseFormData
 * It will parse the form data and return the keys base64-encoded
 */

/**
 * POST /examples/form - Shows an example of a function with a form data
 * 
 * @param {Object} formData - The form data
 * @returns {Object} - The form data keys base64-encoded
 * @throws {Error} - If the form data is not base64-encoded
 */
export default ({ formData }: any) => {
    if (!formData || typeof formData !== 'object') {
        throw new Error('Form data must be provided as an object');
    }

    const encoded: Record<string, string> = {};

    // Use Web APIs for base64 encoding (TextEncoder + btoa)
    for (const key in formData) {
        if (Object.prototype.hasOwnProperty.call(formData, key)) {
            try {
                const value = formData[key];
                const strValue = typeof value === 'string' ? value : JSON.stringify(value);
                // Encode string to Uint8Array, then to base64 using btoa
                const uint8 = new TextEncoder().encode(strValue);
                // Convert Uint8Array to binary string
                let binary = '';
                for (let i = 0; i < uint8.length; i++) {
                    binary += String.fromCharCode(uint8[i]);
                }
                const base64 = btoa(binary);
                encoded[key] = base64;
            } catch (e: any) {
                throw new Error(`Failed to base64-encode form data for key "${key}": ${e && e.message ? e.message : e}`);
            }
        }
    }

    return encoded;
}