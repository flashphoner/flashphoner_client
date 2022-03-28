/**
 * Room api based on core api
 *
 * @namespace roomApi
 */
/**
 * Initialize connection
 *
 * @param {Object} options session options
 * @param {String} options.urlServer Server address in form of [ws,wss]://host.domain:port
 * @param {String} options.username Username to login with
 * @returns {roomApi.Session}
 * @memberof roomApi
 * @method connect
 */
import Flashphoner = require("./flashphoner-core");
declare function appSession(options: {
    urlServer: string;
    username: string;
}): Flashphoner.Session;
export namespace events {
    const STATE: string;
    const JOINED: string;
    const LEFT: string;
    const PUBLISHED: string;
    const MESSAGE: string;
    const FAILED: string;
}
export { appSession as connect, Flashphoner as sdk };
