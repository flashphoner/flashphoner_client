/**
 * Server ports configuration for load testing
 *
 */
const SERVER_PORTS = {
    http: 8081,
    https: 8444,
    legacy: {
        http: 9091,
        https: 8888
    },
    ws: 8080,
    wss: 8443,
    hls: {
        http: 8082,
        https: 8445
    }
}
