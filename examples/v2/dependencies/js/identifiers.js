/** Generate a short hexadecimal stream name, not a globally unique UUID. */
export function createStreamName(length = 4) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => (byte % 16).toString(16)).join("");
}
