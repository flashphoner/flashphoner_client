export declare class Call {
    call: () => void;
    answer: (answerOptions: {
        localVideoDisplay: HTMLElement;
        remoteVideoDisplay: HTMLElement;
        receiveAudio?: boolean | undefined;
        receiveVideo?: boolean | undefined;
        constraints?: string | undefined;
        stripCodecs?: string | undefined;
        sipSDP?: Array<string> | undefined;
        sipHeaders?: Array<string> | undefined;
    }) => void;
    hangup: () => void;
    id: () => string;
    getInfo: () => string;
    getErrorInfo: () => string;
    status: () => string;
    getStats: (callbackFn: any, nativeStats: boolean) => any;
    setAudioOutputId: (id: string) => any;
    setVolume: (volume: number) => void;
    getVolume: () => number;
    muteAudio: () => void;
    unmuteAudio: () => void;
    isVideoMuted: () => boolean;
    caller: () => string;
    callee: () => string;
    visibleName: () => string;
    hold: () => void;
    holdForTransfer: () => void;
    unhold: () => void;
    sendDTMF: (number: number, type?: string | undefined) => void;
    transfer: (target: any) => void;
    on: (event: string, callback: any) => Call;
    switchCam: (deviceId: any) => any;
    switchMic: (deviceId: any) => any;
    switchToScreen: (source: string, woExtension: boolean) => any;
    switchToCam: () => void;
    getLogger: () => any;
}

export declare class Stream {
    play: () => void;
    publish: () => void;
    stop: () => void;
    id: () => string;
    status: () => string;
    name: () => string;
    published: () => boolean;
    getRecordInfo: () => string;
    getInfo: () => string;
    getErrorInfo: () => string;
    videoResolution: () => any;
    setAudioOutputId: (id: string) => any;
    setVolume: (volume: number) => void;
    unmuteRemoteAudio: () => void;
    muteRemoteAudio: () => void;
    isRemoteAudioMuted: () => boolean;
    setMicrophoneGain: (volume: number) => void;
    getVolume: () => number;
    muteAudio: () => void;
    unmuteAudio: () => void;
    isAudioMuted: () => boolean;
    muteVideo: () => void;
    unmuteVideo: () => void;
    isVideoMuted: () => boolean;
    getStats: (callbackFn: any, nativeStats: boolean) => any;
    snapshot: () => void;
    getAudioState: () => any;
    getVideoState: () => any;
    getNetworkBandwidth: () => number;
    getRemoteBitrate: () => number;
    fullScreen: () => void;
    on: (event: string, callback: any) => Stream;
    available: () => any;
    switchCam: (deviceId: any) => any;
    switchMic: (deviceId: any) => any;
    switchToScreen: (source: string, woExtension: boolean) => any;
    switchToCam: () => void;
    sendData: (payload: any) => void;
    getLogger: () => any;
}

export declare class Session {
    id: () => string;
    status: () => string;
    getServerUrl: () => string;
    createStream: (options: {
        name: string;
        constraints?: any | undefined;
        mediaProvider: string;
        receiveAudio?: boolean | undefined;
        receiveVideo?: boolean | undefined;
        cacheLocalResources?: boolean | undefined;
        playWidth?: number | undefined;
        playHeight?: number | undefined;
        record?: boolean | undefined;
        display: any;
        custom?: any | undefined;
        stripCodecs?: string | undefined;
        rtmpUrl?: string | undefined;
        mediaConnectionConstraints?: any | undefined;
        flashShowFullScreenButton?: boolean | undefined;
        transport?: string | undefined;
        cvoExtension?: boolean | undefined;
        playoutDelay?: number | undefined;
        useCanvasMediaStream?: boolean | undefined;
        videoContentHint?: string | undefined;
        unmutePlayOnStart?: boolean | undefined;
        sdpHook?: any | undefined
        logger?: any | undefined;
    }) => Stream;
    createCall: (options: {
        callee: string;
        visibleName?: string | undefined;
        constraints?: any | undefined;
        mediaProvider: string;
        receiveAudio?: boolean | undefined;
        receiveVideo?: boolean | undefined;
        cacheLocalResources?: boolean | undefined;
        localVideoDisplay: HTMLElement;
        remoteVideoDisplay: HTMLElement;
        custom?: any | undefined;
        stripCodecs?: string | undefined;
        sipSDP?: Array<string> | undefined;
        sipHeaders?: Array<string> | undefined;
        videoContentHint?: string | undefined;
        toStream?: string | undefined;
        logger?: any | undefined;
    }) => Call;
    getStream: (streamId: string) => any;
    getStreams: () => any[];
    sendData: (data: any) => any;
    disconnect: () => void;
    submitBugReport: (reportObject: any) => void;
    startDebug: () => void;
    stopDebug: () => void;
    on: (event: string, callback: any) => Session;
    getLogger: () => any;
}
export function sendData(data: any): Promise<any>;
export function resolveData(data: any): void;
/**
 * Static initializer.
 *
 * @param {Object} options Global api options
 * @param {Function=} options.mediaProvidersReadyCallback Callback of initialized WebRTC Plugin
 * @param {String=} options.flashMediaProviderSwfLocation Location of media-provider.swf file
 * @param {string=} options.preferredMediaProvider DEPRECATED: Use preferred media provider if available
 * @param {Array=} options.preferredMediaProviders Use preferred media providers order
 * @param {String=} options.receiverLocation Location of WSReceiver.js file
 * @param {String=} options.decoderLocation Location of video-worker2.js file
 * @param {String=} options.screenSharingExtensionId Chrome screen sharing extension id
 * @param {Object=} options.constraints Default local media constraints
 * @param {Object=} options.logger Enable logging
 * @throws {Error} Error if none of MediaProviders available
 * @memberof Flashphoner
 */
export function init(options: {
    mediaProvidersReadyCallback?: Function | undefined;
    flashMediaProviderSwfLocation?: string | undefined;
    preferredMediaProvider?: string | undefined;
    preferredMediaProviders?: any[] | undefined;
    receiverLocation?: string | undefined;
    decoderLocation?: string | undefined;
    screenSharingExtensionId?: string | undefined;
    constraints?: any | undefined;
    logger?: any | undefined;
}): void;
export function isUsingTemasys(): boolean;
/**
 * Get available MediaProviders.
 *
 * @returns {Array} Available MediaProviders
 * @memberof Flashphoner
 */
export function getMediaProviders(): any[];
/**
 * @typedef Flashphoner.MediaDeviceList
 * @type Object
 * @property {Flashphoner.MediaDevice[]} audio Audio devices (microphones)
 * @property {Flashphoner.MediaDevice[]} video Video devices (cameras)
 */
/**
 * @typedef Flashphoner.MediaDevice
 * @type Object
 * @property {String} type Type of device: mic, camera, screen
 * @property {String} id Unique id
 * @property {String} label Device label
 */
/**
 * Get available local media devices
 *
 * @param {String=} mediaProvider Media provider that will be asked for device list
 * @param {Boolean=} labels Ask user for microphone access before getting device list.
 * This will make device label available.
 * @param {Flashphoner.constants.MEDIA_DEVICE_KIND} kind Media devices kind to access:
 * MEDIA_DEVICE_KIND.INPUT (default) get access to input devices only (camera, mic).
 * MEDIA_DEVICE_KIND.OUTPUT get access to output devices only (speaker, headphone).
 * MEDIA_DEVICE_KIND.ALL get access to all devices (cam, mic, speaker, headphone).
 * @param {Object=} deviceConstraints If labels == true.
 * If {audio: true, video: false}, then access to the camera will not be requested.
 * If {audio: false, video: true}, then access to the microphone will not be requested.
 * @returns {Promise.<Flashphoner.MediaDeviceList>} Promise with media device list on fulfill
 * @throws {Error} Error if API is not initialized
 * @memberof Flashphoner
 */
export function getMediaDevices(mediaProvider: string | undefined, labels: boolean | undefined, kind: any, deviceConstraints?: any | undefined): Promise<Flashphoner.MediaDeviceList>;
/**
 * Get access to local media
 *
 * @param {Object} constraints Media constraints
 * @param {Object} constraints.audio Audio constraints
 * @param {String=} constraints.audio.deviceId Audio device id
 * @param {Object} constraints.video Video constraints
 * @param {String=} constraints.video.deviceId Video device id
 * @param {number} constraints.video.width Video width
 * @param {number} constraints.video.height Video height
 * @param {number} constraints.video.frameRate Video fps
 * @param {String} constraints.video.type Video device type: camera, screen
 * @param {String} constraints.video.mediaSource Video source type for FF: screen, window
 * @param {HTMLElement} display Div element local media should be displayed in
 * @param {String} mediaProvider Media provider type
 * @param {Boolean} disableConstraintsNormalization Disable constraints normalization
 * @returns {Promise.<HTMLElement>} Promise with display on fulfill
 * @throws {Error} Error if API is not initialized
 * @memberof Flashphoner
 */
export function getMediaAccess(constraints: {
    audio: {
        deviceId?: string | undefined;
    };
    video: {
        deviceId?: string | undefined;
        width: number;
        height: number;
        frameRate: number;
        type: string;
        mediaSource: string;
    };
}, display: HTMLElement, mediaProvider: string, disableConstraintsNormalization: boolean): Promise<HTMLElement>;
/**
 * Release local media
 *
 * @param {HTMLElement} display Div element with local media
 * @param {String=} mediaProvider Media provider type
 * @returns {Boolean} True if media was found and released
 * @throws {Error} Error if API is not initialized
 * @memberof Flashphoner
 */
export function releaseLocalMedia(display: HTMLElement, mediaProvider?: string | undefined): boolean;
/**
 * Get active sessions.
 *
 * @returns {Session[]} Array containing active sessions
 * @memberof Flashphoner
 */
export function getSessions(): Session[];
/**
 * Get session by id.
 *
 * @param {string} id Session id
 * @returns {Session} Session
 * @memberof Flashphoner
 */
export function getSession(id: string): Session;
/**
 * Create new session and connect to server.
 *
 * @param {Object} options Session options
 * @param {string} options.urlServer Server address in form of [ws,wss]://host.domain:port
 * @param {string} options.authToken Token for auth on server with keepalived client
 * @param {Boolean=} options.keepAlive Keep alive client on server after disconnect
 * @param {string=} options.lbUrl Load-balancer address
 * @param {string=} options.flashProto Flash protocol [rtmp,rtmfp]
 * @param {Integer=} options.flashPort Flash server port [1935]
 * @param {string=} options.appKey REST App key
 * @param {Object=} options.custom User provided custom object that will be available in REST App code
 * @param {Object=} options.sipOptions Sip configuration
 * @param {Object=} options.mediaOptions Media connection configuration
 * @param {Integer=} options.timeout Connection timeout in milliseconds
 * @param {Integer=} options.pingInterval Server ping interval in milliseconds [0]
 * @param {Integer=} options.receiveProbes A maximum subsequental pings received missing count [0]
 * @param {Integer=} options.probesInterval Interval to check subsequental pings received [0]
 * @returns {Session} Created session
 * @throws {Error} Error if API is not initialized
 * @throws {TypeError} Error if options.urlServer is not specified
 * @memberof Flashphoner
 */
export function createSession(options: {
    urlServer: string;
    authToken?: string;
    keepAlive?: boolean | undefined;
    lbUrl?: string | undefined;
    flashProto?: string | undefined;
    flashPort?: number | undefined;
    appKey?: string | undefined;
    custom?: any | undefined;
    sipOptions?: any | undefined;
    mediaOptions?: any | undefined;
    timeout?: number | undefined;
    pingInterval?: number | undefined;
    receiveProbes?: number | undefined;
    probesInterval?: number | undefined;
    logger?: any | undefined;
}): Session;
/**
 * Play audio chunk
 * @param {boolean} noise Use noise in playing
 * @memberof Flashphoner
 */
export function playFirstSound(noise?: boolean): void;
/**
 * Play video chunk
 *
 * @memberof Flashphoner
 */
export function playFirstVideo(display: any, isLocal: any, src: any): any;
/**
 * Get logger
 *
 * @returns {Object} Logger
 * @memberof Flashphoner
 */
export function getLogger(): any;
import constants = require("@flashphoner/websdk/src/constants");
declare namespace Flashphoner {
    type MediaDeviceList = {
        /**
         * Video devices (cameras)
         */
        video: Flashphoner.MediaDevice[];
    };
    type MediaDevice = {
        /**
         * Unique id
         */
        id: string;
        /**
         * Device label
         */
        label: string;
    };
}
export declare const firefoxScreenSharingExtensionInstalled: boolean;
export declare const Browser: {
    isIE: () => boolean;
    isFirefox: () => boolean;
    isChrome: () => boolean;
    isEdge: () => boolean;
    isOpera: () => boolean;
    isiOS: () => boolean;
    isSafari: () => boolean;
    isAndroid: () => boolean;
    isSafariWebRTC: () => boolean;
    isSamsungBrowser: () => boolean;
    isAndroidFirefox: () => boolean;
    isChromiumEdge: () => boolean;
};
export { constants };
