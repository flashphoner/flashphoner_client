import {isLoopbackHost} from "./server-url.js";

const REQUEST_TIMEOUT = 15000;

export function parseWcsRestAddress(raw, originOnly = false) {
    let address;
    try {
        address = new URL(raw);
    } catch {
        throw new Error("Enter an HTTP or HTTPS WCS REST API URL.");
    }
    const allowedPaths = originOnly ? ["/"] : ["/", "/rest-api", "/rest-api/"];
    if (!["http:", "https:"].includes(address.protocol) || !allowedPaths.includes(address.pathname)
            || address.username || address.password || address.search || address.hash) {
        throw new Error("Enter a WCS origin or a URL ending in /rest-api, without credentials or a query.");
    }
    return address;
}

function restHeaders(address, hasBody, authorization) {
    const headers = {};
    if (authorization) {
        if (address.protocol !== "https:" && !isLoopbackHost(address.hostname)) {
            throw new Error("REST authorization requires HTTPS or a local loopback address.");
        }
        if (!/^(Basic|Bearer) [\x21-\x7e]+$/.test(authorization)) {
            throw new Error("Enter the full Basic or Bearer authorization value.");
        }
        headers.Authorization = authorization;
    }
    if (hasBody) {
        headers["Content-Type"] = "application/json";
    }
    return headers;
}

export async function requestWcsRest(address, path, payload, {authorization = "", missingIsEmpty = false} = {}) {
    const hasBody = payload !== undefined;
    const headers = restHeaders(address, hasBody, authorization);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        let response;
        try {
            response = await fetch(`${address.origin}/rest-api${path}`, {
                method: hasBody ? "POST" : "GET",
                headers,
                body: hasBody ? JSON.stringify(payload) : undefined,
                credentials: "omit",
                redirect: "error",
                cache: "no-store",
                signal: controller.signal
            });
        } catch {
            throw new Error(controller.signal.aborted
                ? "The WCS REST request timed out."
                : "Cannot reach the WCS REST API. Check the URL, certificate and CORS settings.");
        }
        if (missingIsEmpty && response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw Object.assign(new Error(`WCS REST request failed (HTTP ${response.status}).`), {
                status: response.status
            });
        }
        const body = await response.text();
        if (!body) {
            return null;
        }
        try {
            return JSON.parse(body);
        } catch {
            throw new Error("WCS returned an invalid REST response.");
        }
    } finally {
        clearTimeout(timeout);
    }
}
