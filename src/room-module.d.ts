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
 * @param {String} options.token JWT token
 * @param {String} options.appKey Application key
 * @returns {roomApi.Session}
 * @memberof roomApi
 * @method connect
 */
import Flashphoner = require("./flashphoner-core");
declare function appSession(options: {
    urlServer: string;
    username: string;
    token?: string;
    appKey?: string;
}): RoomSession;
export declare class RoomSession extends Flashphoner.Session {
    getRooms: () => Room[];
    join: ({name, record}: {name: string, record: boolean}) => Room;
    username: () => string;
}
export declare class Room {
    name: () => string;
    leave: () => Promise<any>;
    publish: (options: Flashphoner.CreateStreamOptions) => any;
    getParticipants: () => Participant[];
    on: (event: string, callback: any) => Room;
}
export declare class Participant {
    getStreams: () => ParticipantStream[];
    name: () => string;
    sendMessage: (text: any, error: any) => void; //msg in chat (text - msg to send; error- err callback)
    streams: ParticipantStreams;
}
export type ParticipantStreams = { [key: string]: ParticipantStream };
export declare class ParticipantStream {
    play: (display: any, options?: {}) => Flashphoner.Stream;
    stop: () => void;
    id: () => string;
    streamName: () => string
}
export namespace events {
    const STATE: string;
    const JOINED: string;
    const LEFT: string;
    const PUBLISHED: string;
    const MESSAGE: string;
    const FAILED: string;
}
export { appSession as connect, Flashphoner as sdk };
