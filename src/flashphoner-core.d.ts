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
        sdpHook?: any | undefined;
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

export namespace Browser {
    export function isIE(): boolean;
    export function isFirefox(): boolean;
    export function isChrome(): boolean;
    export function isEdge(): boolean;
    export function isOpera(): boolean;
    export function isiOS(): boolean;
    export function isSafari(): boolean;
    export function isAndroid(): boolean;
    export function isSafariWebRTC(): boolean;
    export function isSamsungBrowser(): boolean;
    export function isAndroidFirefox(): boolean;
}

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
export function getMediaProviders(): any[];
export function getMediaDevices(
    mediaProvider: string | undefined,
    labels: boolean | undefined,
    kind: any,
    deviceConstraints: any | undefined): any;
export function getMediaAccess(
    constraints: {
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
    }, display: HTMLElement, mediaProvider: string, disableConstraintsNormalization: boolean): any;
export function releaseLocalMedia(display: HTMLElement, mediaProvider?: string | undefined): boolean;
export function getSessions(): any[];
export function getSession(id: string): any;
export function createSession(options: {
    urlServer: string;
    authToken?: string;
    keepAlive?: boolean | undefined;
    lbUrl?: string | undefined;
    flashProto?: string | undefined;
    flashPort?: any | undefined;
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
export function playFirstSound (noise?: boolean): any;
export function playFirstVideo (display: any, isLocal: boolean, src: any): any;
export function getLogger(): any;
import { constants } from "@flashphoner/websdk/src/constants";
export declare const firefoxScreenSharingExtensionInstalled: boolean;
export { constants };
