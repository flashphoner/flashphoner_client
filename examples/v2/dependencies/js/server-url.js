const DEFAULT_PORTS = Object.freeze({
    http: 8081,
    https: 8444,
    legacy: Object.freeze({http: 9091, https: 8888}),
    ws: 8080,
    wss: 8443,
    hls: Object.freeze({http: 8082, https: 8445})
});

function configuredServerPorts() {
    // The classic ports.js script exposes a global binding, not necessarily a window property.
    return typeof SERVER_PORTS === "undefined" ? {} : SERVER_PORTS;
}

export function getPortsConfig(ports = configuredServerPorts()) {
    return {
        http: ports?.http ?? DEFAULT_PORTS.http,
        https: ports?.https ?? DEFAULT_PORTS.https,
        legacy: {
            http: ports?.legacy?.http ?? DEFAULT_PORTS.legacy.http,
            https: ports?.legacy?.https ?? DEFAULT_PORTS.legacy.https
        },
        ws: ports?.ws ?? DEFAULT_PORTS.ws,
        wss: ports?.wss ?? DEFAULT_PORTS.wss,
        hls: {
            http: ports?.hls?.http ?? DEFAULT_PORTS.hls.http,
            https: ports?.hls?.https ?? DEFAULT_PORTS.hls.https
        }
    };
}

function getWebProtocol() {
    return window.location.protocol === "http:" ? "http" : "https";
}

export function isLoopbackHost(hostname) {
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

export function readStreamAddress(value) {
    try {
        const address = new URL(value.trim());
        const name = decodeURIComponent(address.pathname.slice(1));
        if (!["ws:", "wss:"].includes(address.protocol) || !name || name.includes("/") || address.search || address.hash || address.username || address.password) {
            return null;
        }
        return {server: `${address.protocol}//${address.host}`, name};
    } catch {
        return null;
    }
}

export function getWebsocketUrl(hostName, hostPort, ports = configuredServerPorts()) {
    if (hostName === undefined && hostPort === undefined && window.WCS_SERVER_URL !== undefined) {
        if (typeof window.WCS_SERVER_URL !== "string") {
            throw new Error("Invalid embedded WebSocket server URL");
        }
        const address = new URL(window.WCS_SERVER_URL);
        if (!["ws:", "wss:"].includes(address.protocol) || address.pathname !== "/"
                || address.search || address.hash || address.username || address.password) {
            throw new Error("Invalid embedded WebSocket server URL");
        }
        return address.origin;
    }
    const protocol = window.location.protocol === "http:" ? "ws" : "wss";
    const port = hostPort ?? getPortsConfig(ports)[protocol];
    return `${protocol}://${hostName ?? window.location.hostname}:${port}`;
}

export function getWebOrigin(serverUrl = getWebsocketUrl(), ports = configuredServerPorts()) {
    const server = new URL(serverUrl);
    if (!["ws:", "wss:"].includes(server.protocol) || server.pathname !== "/"
            || server.search || server.hash || server.username || server.password) {
        throw new Error("Invalid WebSocket server URL");
    }
    if (window.WCS_WEB_URL !== undefined && server.origin === new URL(getWebsocketUrl()).origin) {
        const web = new URL(window.WCS_WEB_URL);
        if (typeof window.WCS_WEB_URL !== "string" || !["http:", "https:"].includes(web.protocol)
                || web.pathname !== "/" || web.search || web.hash || web.username || web.password) {
            throw new Error("Invalid embedded web server URL");
        }
        return web.origin;
    }
    const protocol = server.protocol === "wss:" ? "https" : "http";
    if (window.WCS_SERVER_URL === undefined && server.hostname === window.location.hostname
            && window.location.protocol === protocol + ":") {
        return window.location.origin;
    }
    return `${protocol}://${server.hostname}:${getPortsConfig(ports)[protocol]}`;
}

export function getHLSUrl(hostName, hostPort, ports = configuredServerPorts()) {
    if (hostName === undefined && hostPort === undefined && typeof window.getHLSUrl === "function") {
        const address = new URL(window.getHLSUrl());
        if (!["http:", "https:"].includes(address.protocol) || address.pathname !== "/"
                || address.search || address.hash || address.username || address.password) {
            throw new Error("Invalid embedded HLS server URL");
        }
        return address.origin;
    }
    const protocol = getWebProtocol();
    const port = hostPort ?? getPortsConfig(ports).hls[protocol];
    return `${protocol}://${hostName ?? window.location.hostname}:${port}`;
}

export function getRestUrl(hostName = window.location.hostname, hostPort, ports = configuredServerPorts()) {
    const protocol = getWebProtocol();
    const port = hostPort ?? getPortsConfig(ports)[protocol];
    return `${protocol}://${hostName}:${port}`;
}

export function getAdminUrl(hostName = window.location.hostname, hostPort, ports = configuredServerPorts()) {
    const protocol = getWebProtocol();
    const port = hostPort ?? getPortsConfig(ports).legacy[protocol];
    return `${protocol}://${hostName}:${port}`;
}
