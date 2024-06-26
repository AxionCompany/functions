import jwt from 'npm:jsonwebtoken'

const generateSalt = () => {
    const byteArray = new Uint8Array(16);
    crypto.getRandomValues(byteArray);
    const hashHex = Array.from(byteArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hashHex;
};

const createHash = async (text, salt='') => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hashHex;
};

const generateJWT = (payload, { expiresIn, ...options }) => {
    return jwt.sign(payload, options.secretKey, { expiresIn: expiresIn || '1h' });
};

// validateJWT
const validateJWT = (token, options) => {
    return jwt.verify(token, options.secretKey);
}

export {
    generateSalt,
    createHash,
    generateJWT,
    validateJWT
};