'use strict';

var uuid = require('node-uuid');
var constants = require("./constants");
var util = require('./util');
var logger = require('./util').logger;
var loggerConf = {push: false, severity: "INFO"};
var Promise = require('promise-polyfill');
var browser = require('webrtc-adapter').browserDetails;
var LOG_PREFIX = "core";

/**
 * @namespace Flashphoner
 */

var SESSION_STATUS = constants.SESSION_STATUS;
var STREAM_STATUS = constants.STREAM_STATUS;
var CALL_STATUS = constants.CALL_STATUS;
var MediaProvider = {};
var sessions = {};
var initialized = false;

/**
 * Static initializer.
 *
 * @param {Object} options Global api options
 * @param {String=} options.flashMediaProviderSwfLocation Location of media-provider.swf file
 * @param {string=} options.preferredMediaProvider Use preferred media provider if available
 * @param {String=} options.receiverLocation Location of WSReceiver.js file
 * @param {String=} options.decoderLocation Location of video-worker2.js file
 * @param {String=} options.screenSharingExtensionId Chrome screen sharing extension id
 * @param {Object=} options.constraints Default local media constraints
 * @param {Object=} options.logger Enable logging
 * @throws {Error} Error if none of MediaProviders available
 * @memberof Flashphoner
 */
var init = function(options) {
    if (!initialized) {
        if (!options) {
            options = {};
        }
        loggerConf = options.logger || loggerConf;
        // init logger
        logger.init(loggerConf.severity, loggerConf.push);
        var webRtcProvider = require("./webrtc-media-provider");
        if (webRtcProvider && webRtcProvider.hasOwnProperty('available') && webRtcProvider.available()) {
            MediaProvider.WebRTC = webRtcProvider;
            var webRtcConf = {
                constraints: options.constraints || getDefaultMediaConstraints(),
                extensionId: options.screenSharingExtensionId,
                logger: logger
            };
            webRtcProvider.configure(webRtcConf);
        }
        var flashProvider = require("./flash-media-provider");
        if (flashProvider && flashProvider.hasOwnProperty('available') && flashProvider.available() && !MediaProvider.WebRTC) {
            MediaProvider.Flash = flashProvider;
            var flashConf = {
                constraints: options.constraints || getDefaultMediaConstraints(),
                flashMediaProviderSwfLocation: options.flashMediaProviderSwfLocation,
                logger: logger
            };
            flashProvider.configure(flashConf);
        }
        var websocketProvider = require("./websocket-media-provider");
        if (websocketProvider && websocketProvider.hasOwnProperty('available') && websocketProvider.available()) {
            MediaProvider.WSPlayer = websocketProvider;
            var wsConf = {
                receiverLocation: options.receiverLocation,
                decoderLocation: options.decoderLocation,
                logger: logger
            };
            websocketProvider.configure(wsConf);
        }
        //check at least 1 provider available
        if (getMediaProviders().length == 0) {
            throw new Error('None of MediaProviders available');
        } else if (options.preferredMediaProvider) {
            if (MediaProvider.hasOwnProperty(options.preferredMediaProvider)) {
                if (getMediaProviders()[0] != options.preferredMediaProvider) {
                    // Just reorder media provider list
                    var _MediaProvider = {};
                    _MediaProvider[options.preferredMediaProvider] = MediaProvider[options.preferredMediaProvider];
                    for (var p in MediaProvider) {
                        _MediaProvider[p] = MediaProvider[p];
                    }
                    MediaProvider = _MediaProvider;
                }
            } else {
              logger.warn(LOG_PREFIX, "Preferred media provider is not available.");
            }
        }
        logger.info(LOG_PREFIX, "Initialized");
        initialized = true;
    }
};

/**
 * Get available MediaProviders.
 *
 * @returns {Array} Available MediaProviders
 * @memberof Flashphoner
 */
var getMediaProviders = function() {
    return Object.keys(MediaProvider);
};

/**
 * Play audio chunk
 *
 * @memberof Flashphoner
 */

var playFirstSound = function() {
    var mediaProvider = getMediaProviders()[0];
    MediaProvider[mediaProvider].playFirstSound();
}

/**
 * Get logger
 *
 * @returns {Object} Logger
 * @memberof Flashphoner
 */

var getLogger = function() {
    if (!initialized) {
        console.warn("Initialize API first.");
    } else {
        return logger;
    }
}

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
 * @returns {Promise.<Flashphoner.MediaDeviceList>} Promise with media device list on fulfill
 * @throws {Error} Error if API is not initialized
 * @memberof Flashphoner
 */
var getMediaDevices = function(mediaProvider, labels) {
    if (!initialized) {
        throw new Error("Flashphoner API is not initialized");
    }
    if (!mediaProvider) {
        mediaProvider = getMediaProviders()[0];
    }
    return MediaProvider[mediaProvider].listDevices(labels);
};

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
 * @param {HTMLElement} display Div element local media should be displayed in
 * @param {String} mediaProvider Media provider type
 * @returns {Promise.<HTMLElement>} Promise with display on fulfill
 * @throws {Error} Error if API is not initialized
 * @memberof Flashphoner
 */

var getMediaAccess = function(constraints, display, mediaProvider) {
    if (!initialized) {
        throw new Error("Flashphoner API is not initialized");
    }
    if (!mediaProvider) {
        mediaProvider = getMediaProviders()[0];
    }
    return MediaProvider[mediaProvider].getMediaAccess(constraints, display);
};

//default constraints helper
var getDefaultMediaConstraints = function() {
    return {
        audio: true,
        video: {
            width: 320,
            height: 240
        }
    };
};

function checkConstraints(constraints) {
    if (constraints.video) {
        if (constraints.video.hasOwnProperty('width')) {
            var width = constraints.video.width;
            if (width == 0 || isNaN(width)) {
                logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                constraints.video.width = 320;
                constraints.video.height = 240;
            }
        }
        if (constraints.video.hasOwnProperty('height')) {
            var height = constraints.video.height;
            if (height == 0 || isNaN(height)) {
                logger.warn(LOG_PREFIX, "Width or height property has zero/NaN value, set default resolution 320x240");
                constraints.video.width = 320;
                constraints.video.height = 240;
            }
        }
    }
    return constraints;
}

function getConstraintsProperty(constraints, property, defaultValue) {
    if (!constraints || !property) return defaultValue;
    var res;
    var properties = property.split(".");
    for (var prop in constraints) {
        if (prop == properties[0]) {
            res = constraints[prop];
            if (properties.length > 1) res = getConstraintsProperty(constraints[prop], properties[1], defaultValue);
        } else if (typeof constraints[prop] === "object") {
            for (var p in constraints[prop]) {
                if (p == property) res = constraints[prop][p];
            }
        }
    }
    if (typeof res === "boolean") return res;
    return res || defaultValue;
}

/**
 * Release local media
 *
 * @param {HTMLElement} display Div element with local media
 * @param {String=} mediaProvider Media provider type
 * @returns {Boolean} True if media was found and released
 * @throws {Error} Error if API is not initialized
 * @memberof Flashphoner
 */

var releaseLocalMedia = function(display, mediaProvider) {
    if (!initialized) {
        throw new Error("Flashphoner API is not initialized");
    }
    if (!mediaProvider) {
        mediaProvider = getMediaProviders()[0];
    }
    return MediaProvider[mediaProvider].releaseMedia(display);
};

/**
 * Get active sessions.
 *
 * @returns {Session[]} Array containing active sessions
 * @memberof Flashphoner
 */
var getSessions = function() {
    return util.copyObjectToArray(sessions);
};

/**
 * Get session by id.
 *
 * @param {string} id Session id
 * @returns {Session} Session
 * @memberof Flashphoner
 */
var getSession = function(id) {
    return sessions[id];
};

/**
 * Create new session and connect to server.
 *
 * @param {Object} options Session options
 * @param {string} options.urlServer Server address in form of [ws,wss]://host.domain:port
 * @param {string=} options.appKey REST App key
 * @param {Object=} options.custom User provided custom object that will be available in REST App code
 * @param {Object=} options.sipOptions Sip configuration
 * @returns {Session} Created session
 * @throws {Error} Error if API is not initialized
 * @throws {TypeError} Error if options.urlServer is not specified
 * @memberof Flashphoner
 */
var createSession = function(options) {
    if (!initialized) {
        throw new Error("Flashphoner API is not initialized");
    }

    if (!options || !options.urlServer) {
        throw new TypeError("options.urlServer must be provided");
    }

    var id_ = uuid.v1();
    var sessionStatus = SESSION_STATUS.PENDING;
    var urlServer = options.urlServer;
    var appKey = options.appKey || "defaultApp";
    //SIP config
    var sipConfig;
    if (options.sipOptions) {
        sipConfig = {
            sipLogin: options.sipOptions.login,
            sipAuthenticationName: options.sipOptions.authenticationName,
            sipPassword: options.sipOptions.password,
            sipDomain: options.sipOptions.domain,
            sipOutboundProxy: options.sipOptions.outboundProxy,
            sipProxy: options.sipOptions.proxy,
            sipPort: options.sipOptions.port,
            sipRegisterRequired: options.sipOptions.registerRequired
        }
    }
    //media provider auth token received from server
    var authToken;
    //object for storing new and active streams
    var streams = {};
    var calls = {};
    var mediaConnections = {};
    //session to stream callbacks
    var streamRefreshHandlers = {};
    //session to call callbacks
    var callRefreshHandlers = {};
    /**
     * Represents connection to REST App.
     * Can create and store Streams.
     *
     * @see Flashphoner.createSession
     * @namespace Session
     */
    var session = {};
    //callbacks added using session.on()
    var callbacks = {};

    //connect session to server
    var wsConnection = new WebSocket(urlServer);
    wsConnection.onerror = function() {
        onSessionStatusChange(SESSION_STATUS.FAILED);
    };
    wsConnection.onclose = function() {
        if (sessionStatus !== SESSION_STATUS.FAILED) {
            onSessionStatusChange(SESSION_STATUS.DISCONNECTED);
        }
    };
    wsConnection.onopen = function() {
        onSessionStatusChange(SESSION_STATUS.CONNECTED);
        var cConfig = {
            appKey: appKey,
            mediaProviders: Object.keys(MediaProvider),
            clientVersion: "0.5.12",
            clientOSVersion: window.navigator.appVersion,
            clientBrowserVersion: window.navigator.userAgent,
            custom: options.custom,
        };
        if (getMediaProviders()[0] == "WSPlayer") {
            cConfig.useWsTunnel = true;
            cConfig.useWsTunnelPacketization2 = true;
            cConfig.useBase64BinaryEncoding = false;
        }
        if (sipConfig) {
            util.copyObjectPropsToAnotherObject(sipConfig, cConfig);
        }
        //connect to REST App
        send("connection", cConfig);
        logger.setConnection(wsConnection);
    };
    //todo remove
    var remoteSdpCache = {};
    wsConnection.onmessage = function(event) {
        var data = {};
        if (event.data instanceof Blob) {
            data.message = "binaryData";
        } else {
            data = JSON.parse(event.data);
            var obj = data.data[0];
        }
        switch (data.message) {
            case 'ping':
                send("pong", null);
                break;
            case 'getUserData':
                authToken = obj.authToken;
                onSessionStatusChange(SESSION_STATUS.ESTABLISHED);
                break;
            case 'setRemoteSDP':
                var mediaSessionId = data.data[0];
                var sdp = data.data[1];
                if (streamRefreshHandlers[mediaSessionId]) {
                    //pass server's sdp to stream
                    streamRefreshHandlers[mediaSessionId](null, sdp);
                } else if (callRefreshHandlers[mediaSessionId]) {
                    //pass server's sdp to call
                    callRefreshHandlers[mediaSessionId](null, sdp);
                } else {
                    remoteSdpCache[mediaSessionId] = sdp;
                    logger.warn(LOG_PREFIX, "Media not found, id " + mediaSessionId);
                }
                break;
            case 'notifyVideoFormat':
            case 'notifyStreamStatusEvent':
                if (streamRefreshHandlers[obj.mediaSessionId]) {
                    //update stream status
                    streamRefreshHandlers[obj.mediaSessionId](obj);
                }
                break;
            case 'DataStatusEvent':
                restAppCommunicator.resolveData(obj);
                break;
            case 'OnDataEvent':
                if (callbacks[SESSION_STATUS.APP_DATA]) {
                    callbacks[SESSION_STATUS.APP_DATA](obj);
                }
                break;
            case 'fail':
                if (obj.apiMethod && obj.apiMethod == "StreamStatusEvent") {
                    if (streamRefreshHandlers[obj.id]) {
                        //update stream status
                        streamRefreshHandlers[obj.id](obj);
                    }
                }
                break;
            case 'registered':
                onSessionStatusChange(SESSION_STATUS.REGISTERED);
                break;
            case 'notifyAudioCodec':
                // This case for Flash only
                var mediaSessionId = data.data[0];
                var codec = data.data[1];
                if (callRefreshHandlers[mediaSessionId]) {
                    callRefreshHandlers[mediaSessionId](null, null, codec);
                }
                break;
            case 'notifyTransferEvent':
                callRefreshHandlers[obj.callId](null, null, null, obj);
                break;
            case 'notifyTryingResponse':
            case 'hold':
            case 'ring':
            case 'talk':
            case 'finish':
                if (callRefreshHandlers[obj.callId]) {
                    //update call status
                    callRefreshHandlers[obj.callId](obj);
                }
                break;
            case 'notifyIncomingCall':
                if (callRefreshHandlers[obj.callId]) {
                    logger.error(LOG_PREFIX, "Call already exists, id " + obj.callId);
                }
                if (callbacks[SESSION_STATUS.INCOMING_CALL]) {
                    callbacks[SESSION_STATUS.INCOMING_CALL](createCall(obj));
                } else {
                    //todo hangup call
                }
                break;
            default:
                //logger.info(LOG_PREFIX, "Unknown server message " + data.message);
        }
    };

    //WebSocket send helper
    function send(message, data) {
        wsConnection.send(JSON.stringify({
            message: message,
            data: [data]
        }));
    }

    //Session status update helper
    function onSessionStatusChange(newStatus) {
        sessionStatus = newStatus;
        if (sessionStatus == SESSION_STATUS.DISCONNECTED || sessionStatus == SESSION_STATUS.FAILED) {
            //remove streams
            for (var prop in streamRefreshHandlers) {
                if (streamRefreshHandlers.hasOwnProperty(prop) && typeof streamRefreshHandlers[prop] === 'function') {
                    streamRefreshHandlers[prop]({status: STREAM_STATUS.FAILED});
                }
            }
            //remove session from list
            delete sessions[id_];
        }
        if (callbacks[sessionStatus]) {
            callbacks[sessionStatus](session);
        }
    }

    /**
     * Create call.
     *
     * @param {Object} options Call options
     * @param {string} options.callee Call remote party id
     * @param {string=} options.visibleName Call caller visible name
     * @param {Object} options.constraints Call constraints
     * @param {string} options.mediaProvider MediaProvider type to use with this call
     * @param {Boolean=} options.receiveAudio Receive audio
     * @param {Boolean=} options.receiveVideo Receive video
     * @param {Boolean=} options.cacheLocalResources Display will contain local video after call release
     * @param {HTMLElement} options.localVideoDisplay Div element local video should be displayed in
     * @param {HTMLElement} options.remoteVideoDisplay Div element remote video should be displayed in
     * @param {Object=} options.custom User provided custom object that will be available in REST App code
     * @param {Array<string>=} options.stripCodecs Array of codecs which should be stripped from SDP (WebRTC)
     * @returns {Call} Call
     * @throws {TypeError} Error if no options provided
     * @throws {Error} Error if session state is not REGISTERED
     * @memberof Session
     * @inner
     */
    var createCall = function(options) {
        //check session state
        if (sessionStatus !== SESSION_STATUS.REGISTERED && sessionStatus !== SESSION_STATUS.ESTABLISHED) {
            logger.info(LOG_PREFIX, "Status is " + sessionStatus);
            throw new Error('Invalid session state');
        }

        //check options
        if (!options) {
            throw new TypeError("options must be provided");
        }
        var login = (appKey == 'clickToCallApp') ? '' : sipConfig.sipLogin;
        var caller_ = (options.incoming) ? options.caller : login;
        var callee_ = options.callee;
        var visibleName_ = options.visibleName || login;

        var id_ = options.callId || uuid.v1();
        var mediaProvider = options.mediaProvider || getMediaProviders()[0];
        var mediaConnection;
        var localDisplay = options.localVideoDisplay;
        var remoteDisplay = options.remoteVideoDisplay;
        // Constraints
        if (options.constraints) {
            var constraints = checkConstraints(options.constraints);
        }
        var stripCodecs = options.stripCodecs || [];
        // Receive media
        var receiveAudio = (typeof options.receiveAudio !== 'undefined') ? options.receiveAudio : true;
        var receiveVideo = (typeof options.receiveVideo !== 'undefined') ? options.receiveVideo : true;

        var cacheLocalResources = options.cacheLocalResources;
        var status_ = CALL_STATUS.NEW;
        var callbacks = {};
        var hasTransferredCall = false;
        /**
         * Represents sip call.
         *
         * @namespace Call
         * @see Session~createCall
         */
        var call = {};
        callRefreshHandlers[id_] = function(callInfo, sdp, codec, transfer) {
            if (transfer) {
                if (!mediaConnections[id_]) {
                    mediaConnections[id_] = mediaConnection;
                }
                if (transfer.status == "COMPLETED") {
                    delete mediaConnections[id_];
                }
                return;
            }

            //transferred call
            if (!mediaConnection && Object.keys(mediaConnections).length != 0) {
                for (var mc in mediaConnections) {
                    mediaConnection = mediaConnections[mc];
                    hasTransferredCall = true;
                    delete mediaConnections[mc];
                }
            }
            //set audio codec (Flash only)
            if (codec) {
                if(mediaProvider == "Flash") {
                    mediaConnection.changeAudioCodec(codec.name);
                }
                return;
            }
            //set remote sdp
            if (sdp && sdp !== '') {
                mediaConnection.setRemoteSdp(sdp, hasTransferredCall, id_).then(function(){});
                return;
            }
            var event = callInfo.status;
            status_ = event;
            //release call
            if (event == CALL_STATUS.FAILED || event == CALL_STATUS.FINISH ||
                event == CALL_STATUS.BUSY) {
                delete calls[id_];
                delete callRefreshHandlers[id_];
                if (Object.keys(calls).length == 0) {
                    if (mediaConnection)
                        mediaConnection.close(cacheLocalResources);
                }
            }
            //fire call event
            if (callbacks[event]) {
                callbacks[event](call);
            }
        };

        /**
         * Initiate outgoing call.
         *
         * @throws {Error} Error if call status is not {@link Flashphoner.constants.CALL_STATUS.NEW}
         * @memberof Call
         * @name call
         * @inner
         */
        var call_ = function() {
            if (status_ !== CALL_STATUS.NEW) {
                throw new Error("Invalid call state");
            }
            status_ = CALL_STATUS.PENDING;
            var hasAudio = true;
            //get access to camera
            MediaProvider[mediaProvider].getMediaAccess(constraints, localDisplay).then(function(){
                if (status_ == CALL_STATUS.FAILED) {
                    //call failed while we were waiting for media access, release media
                    if (!cacheLocalResources) {
                        releaseLocalMedia(localDisplay, mediaProvider);
                    }
                    return;
                }
                //create mediaProvider connection
                MediaProvider[mediaProvider].createConnection({
                    id: id_,
                    localDisplay: localDisplay,
                    remoteDisplay: remoteDisplay,
                    authToken: authToken,
                    mainUrl: urlServer,
                    bidirectional: true,
                    login: login
                }).then(function(newConnection) {
                    mediaConnection = newConnection;
                    return mediaConnection.createOffer({
                        sendAudio: true,
                        sendVideo: true,
                        receiveAudio: receiveAudio,
                        receiveVideo: receiveVideo,
                        stripCodecs: stripCodecs
                    });
                }).then(function (offer) {
                    send("call", {
                        callId: id_,
                        incoming: false,
                        hasVideo: offer.hasVideo,
                        hasAudio: offer.hasAudio,
                        status: status_,
                        mediaProvider: mediaProvider,
                        sdp: offer.sdp,
                        caller: login,
                        callee: callee_,
                        custom: options.custom,
                        visibleName: visibleName_
                    });
                });
            }).catch(function(error){
                logger.error(LOG_PREFIX, error);
                status_ = CALL_STATUS.FAILED;
                callRefreshHandlers[id_]({status: CALL_STATUS.FAILED});
            });
        };

        /**
         * Hangup call.
         *
         * @memberof Call
         * @inner
         */
        var hangup = function() {
            if (status_ == CALL_STATUS.NEW) {
                callRefreshHandlers[id_]({status: CALL_STATUS.FAILED});
                return;
            } else if (status_ == CALL_STATUS.PENDING) {
                if (!cacheLocalResources) {
                    releaseLocalMedia(localDisplay, mediaProvider);
                }
                callRefreshHandlers[id_]({status: CALL_STATUS.FAILED});
                if (options.incoming) {
                    send("hangup", {
                        callId: id_
                    });
                }
                return;
            }

            send("hangup", {
                callId: id_
            });
            //free media provider
            if (mediaConnection) {
                mediaConnection.close(cacheLocalResources);
            }
        };

        /**
         * Answer incoming call.
         * @param {Object} answerOptions Call options
         * @param {HTMLElement} answerOptions.localVideoDisplay Div element local video should be displayed in
         * @param {HTMLElement} answerOptions.remoteVideoDisplay Div element remote video should be displayed in
         * @param {Boolean=} answerOptions.receiveAudio Receive audio
         * @param {Boolean=} answerOptions.receiveVideo Receive video
         * @param {String=} answerOptions.constraints Answer call with constraints
         * @param {Array<string>=} answerOptions.stripCodecs Array of codecs which should be stripped from SDP (WebRTC)
         * @throws {Error} Error if call status is not {@link Flashphoner.constants.CALL_STATUS.NEW}
         * @memberof Call
         * @name call
         * @inner
         */
        var answer = function(answerOptions) {
            if (status_ !== CALL_STATUS.NEW && status_ !== CALL_STATUS.RING) {
                throw new Error("Invalid call state");
            }
            localDisplay = answerOptions.localVideoDisplay;
            remoteDisplay = answerOptions.remoteVideoDisplay;
            constraints = answerOptions.constraints || getDefaultMediaConstraints();
            status_ = CALL_STATUS.PENDING;
            var sdp;
            if (!remoteSdpCache[id_]) {
                logger.error(LOG_PREFIX, "No remote sdp available");
                throw new Error("No remote sdp available");
            } else {
                sdp = remoteSdpCache[id_];
                delete remoteSdpCache[id_];
            }
            if (util.SDP.matchPrefix(sdp,"m=video").length == 0) {
                constraints.video = false;
            }
            var stripCodecs = answerOptions.stripCodecs || [];
            var hasAudio = true;
            //get access to camera
            MediaProvider[mediaProvider].getMediaAccess(constraints, localDisplay).then(function(){
                if (status_ == CALL_STATUS.FAILED) {
                    //call failed while we were waiting for media access, release media
                    if (!cacheLocalResources) {
                        releaseLocalMedia(localDisplay, mediaProvider);
                    }
                    return;
                }
                //create mediaProvider connection
                MediaProvider[mediaProvider].createConnection({
                    id: id_,
                    localDisplay: localDisplay,
                    remoteDisplay: remoteDisplay,
                    authToken: authToken,
                    mainUrl: urlServer,
                    bidirectional: true,
                    login: sipConfig.sipLogin
                }).then(function(newConnection) {
                    mediaConnection = newConnection;
                    return mediaConnection.setRemoteSdp(sdp);
                }).then(function(){
                    return mediaConnection.createAnswer({
                        receiveAudio: options.receiveAudio,
                        receiveVideo: options.receiveVideo,
                        stripCodecs: stripCodecs
                    });
                }).then(function(sdp) {
                    if (status_ != CALL_STATUS.FINISH && status_ != CALL_STATUS.FAILED) {
                        send("answer", {
                            callId: id_,
                            incoming: true,
                            hasVideo: true,
                            hasAudio: hasAudio,
                            status: status_,
                            mediaProvider: mediaProvider,
                            sdp: sdp,
                            caller: sipConfig.login,
                            callee: callee_,
                            custom: options.custom
                        });
                    } else {
                        hangup();
                    }
                });
            }).catch(function(error){
                logger.error(LOG_PREFIX, error);
                status_ = CALL_STATUS.FAILED;
                callRefreshHandlers[id_]({status: CALL_STATUS.FAILED});
            });
        };

        /**
         * Get call status.
         *
         * @returns {string} One of {@link Flashphoner.constants.CALL_STATUS}
         * @memberof Call
         * @inner
         */
        var status = function() {
            return status_;
        };

        /**
         * Get call id.
         *
         * @returns {string} Call id
         * @memberof Call
         * @inner
         */
        var id = function() {
            return id_;
        };
        /**
         * Get caller id.
         *
         * @returns {string} Caller id
         * @memberof Call
         * @inner
         */
        var caller = function() {
            return caller_;
        };
        /**
         * Get callee id.
         *
         * @returns {string} Callee id
         * @memberof Call
         * @inner
         */
        var callee = function() {
            return callee_;
        };
        /**
         * Get caller visible name.
         *
         * @returns {string} Caller visible name
         * @memberof Call
         * @inner
         */
        var visibleName = function() {
            return visibleName_;
        };
        /**
         * Media controls
         */

        /**
         * Set volume of remote media
         *
         * @param {number} volume Volume between 0 and 100
         * @memberof Call
         * @inner
         */
        var setVolume = function(volume) {
            if (mediaConnection) {
                mediaConnection.setVolume(volume);
            }
        };

        /**
         * Get current volume
         *
         * @returns {number} Volume or -1 if audio is not available
         * @memberof Call
         * @inner
         */
        var getVolume = function() {
            if (mediaConnection) {
                return mediaConnection.getVolume();
            }
            return -1;
        };

        /**
         * Mute outgoing audio
         *
         * @memberof Call
         * @inner
         */
        var muteAudio = function() {
            if (mediaConnection) {
                mediaConnection.muteAudio();
            }
        };

        /**
         * Unmute outgoing audio
         *
         * @memberof Call
         * @inner
         */
        var unmuteAudio = function() {
            if (mediaConnection) {
                mediaConnection.unmuteAudio();
            }
        };

        /**
         * Check outgoing audio mute state
         *
         * @returns {boolean} True if audio is muted or not available
         * @memberof Call
         * @inner
         */
        var isAudioMuted = function() {
            if (mediaConnection) {
                return mediaConnection.isAudioMuted();
            }
            return true;
        };

        /**
         * Mute outgoing video
         *
         * @memberof Call
         * @inner
         */
        var muteVideo = function() {
            if (mediaConnection) {
                mediaConnection.muteVideo();
            }
        };

        /**
         * Unmute outgoing video
         *
         * @memberof Call
         * @inner
         */
        var unmuteVideo = function() {
            if (mediaConnection) {
                mediaConnection.unmuteVideo();
            }
        };

        /**
         * Check outgoing video mute state
         *
         * @returns {boolean} True if video is muted or not available
         * @memberof Call
         * @inner
         */
        var isVideoMuted = function() {
            if (mediaConnection) {
                return mediaConnection.isVideoMuted();
            }
            return true;
        };
        /**
         * Get statistics
         *
         * @returns {Object} Call audio\video statistics
         * @memberof Call
         * @inner
         */
        var getStats = function () {
            if (mediaConnection) {
                return mediaConnection.getStats();
            }
        };
        /**
         * Place call on hold
         *
         * @memberof Call
         * @inner
         */
        var hold = function() {
            send("hold", {callId: id_});
        }
        /**
         * Place call on hold for transfer
         *
         * @memberof Call
         * @inner
         */
        var holdForTransfer = function() {
            send("hold", {callId: id_, holdForTransfer: true});
        }
        /**
         * Unhold the call
         *
         * @memberof Call
         * @inner
         */
        var unhold = function() {
            send("unhold", {callId: id_});
        }
        /**
         * Send DTMF
         *
         * @param {number} number Number
         * @param {string=} type DTMF Type (RFC2833, INFO, INFO_RELAY)
         * @memberof Call
         * @inner
         */
        var sendDTMF = function(number, type) {
            send("sendDtmf", {
                callId: id_,
                type: type || "RFC2833",
                dtmf: number
            });
        }
        /**
         * Transfer call
         *
         * @param {String} traget Transfer target
         * @memberof Call
         * @inner
         */
        var transfer = function(target) {
            send("transfer", {callId: id_, target: target});
        }
        /**
         * Call event callback.
         *
         * @callback Call~eventCallback
         * @param {Call} call Call that corresponds to the event
         */

        /**
         * Add call event callback.
         *
         * @param {string} event One of {@link Flashphoner.constants.CALL_STATUS} events
         * @param {Call~eventCallback} callback Callback function
         * @returns {Call} Call callback was attached to
         * @throws {TypeError} Error if event is not specified
         * @throws {Error} Error if callback is not a valid function
         * @memberof Call
         * @inner
         */
        var on = function(event, callback) {
            if (!event) {
                throw new TypeError("Event can't be null");
            }
            if (!callback || typeof callback !== 'function') {
                throw new Error("Callback needs to be a valid function");
            }
            callbacks[event] = callback;
            return call;
        };

        call.call = call_;
        call.answer = answer;
        call.hangup = hangup;
        call.id = id;
        call.status = status;
        call.getStats = getStats;
        call.setVolume = setVolume;
        call.getVolume = getVolume;
        call.muteAudio = muteAudio;
        call.unmuteAudio = unmuteAudio;
        call.isAudioMuted = isAudioMuted;
        call.muteVideo = muteVideo;
        call.unmuteVideo = unmuteVideo;
        call.isVideoMuted = isVideoMuted;
        call.caller = caller;
        call.callee = callee;
        call.visibleName = visibleName;
        call.hold = hold;
        call.holdForTransfer = holdForTransfer;
        call.unhold = unhold;
        call.sendDTMF = sendDTMF;
        call.transfer = transfer;
        call.on = on;
        calls[id_] = call;
        return call;
    };

    /**
     * Create stream.
     *
     * @param {Object} options Stream options
     * @param {string} options.name Stream name
     * @param {Object=} options.constraints Stream constraints
     * @param {Boolean} [options.constraints.audio=true] Specifies if published stream should have audio. Played stream always should have audio: the property should not be set to false in that case.
     * @param {Boolean|Object} [options.constraints.video=true] Specifies if published or played stream should have video, or sets video constraints
     * @param {Integer} [options.constraints.video.width=0] Set width to publish or play stream with this value
     * @param {Integer} [options.constraints.video.height=0] Set height to publish or play stream with this value
     * @param {Integer} [options.constraints.video.bitrate=0] Set bitrate to publish or play stream with this value
     * @param {Integer} [options.constraints.video.quality=0] Set quality to play stream with this value
     * @param {Boolean=} options.receiveAudio DEPRECATED: Receive audio
     * @param {Boolean=} options.receiveVideo DEPRECATED: Receive video
     * @param {Integer=} options.playWidth DEPRECATED: Set width to play stream with this value
     * @param {Integer=} options.playHeight DEPRECATED: Set height to play stream with this value
     * @param {string=} options.mediaProvider MediaProvider type to use with this stream
     * @param {Boolean} [options.record=false] Enable stream recording
     * @param {Boolean=} options.cacheLocalResources Display will contain local video after stream release
     * @param {HTMLElement} options.display Div element stream should be displayed in
     * @param {Object=} options.custom User provided custom object that will be available in REST App code
     * @param {Integer} [options.flashBufferTime=0] Specifies how long to buffer messages before starting to display the stream (Flash-only)
     * @param {Array<string>=} options.stripCodecs Array of codecs which should be stripped from SDP (WebRTC)
     * @returns {Stream} Stream
     * @throws {TypeError} Error if no options provided
     * @throws {TypeError} Error if options.name is not specified
     * @throws {Error} Error if session state is not ESTABLISHED
     * @memberof Session
     * @inner
     */
    var createStream = function(options) {
        //check session state
        if (sessionStatus !== SESSION_STATUS.ESTABLISHED) {
            throw new Error('Invalid session state');
        }

        //check options
        if (!options) {
            throw new TypeError("options must be provided");
        }
        if (!options.name) {
            throw new TypeError("options.name must be provided");
        }

        var id_ = uuid.v1();
        var name_ = options.name;
        var mediaProvider = options.mediaProvider || getMediaProviders()[0];
        var mediaConnection;
        var display = options.display;
        // Constraints
        if (options.constraints && Object.keys(options.constraints).length != 0) {
            var constraints = checkConstraints(options.constraints);
        }
        // Receive media
        var receiveAudio;
        var audioProperty = getConstraintsProperty(constraints, "audio", undefined);
        if (typeof audioProperty === 'boolean') {
            receiveAudio = audioProperty;
        } else if (typeof audioProperty === 'object') {
            receiveAudio = true;
            var _stereo = getConstraintsProperty(audioProperty,"stereo",0);
            var _bitrate = getConstraintsProperty(audioProperty,"bitrate",0);
            var _fec = getConstraintsProperty(audioProperty,"fec",0);
            var _codecOptions = "";
            if (_bitrate) _codecOptions += "maxaveragebitrate=" + _bitrate + ";";
            if (_stereo) _codecOptions += "stereo=1;sprop-stereo=1;";
            if (_fec) _codecOptions += "useinbandfec=1;";
        } else {
            receiveAudio = (typeof options.receiveAudio !== 'undefined') ? options.receiveAudio : true;
        }
        var receiveVideo;
        var videoProperty = getConstraintsProperty(constraints, "video", undefined);
        if (typeof videoProperty === 'boolean') {
            receiveVideo = videoProperty;
        } else if (typeof videoProperty === 'object') {
            receiveVideo = true;
        } else {
            receiveVideo = (typeof options.receiveVideo !== 'undefined') ? options.receiveVideo : true;
        }
        // Bitrate
        var bitrate = getConstraintsProperty(constraints, "video.bitrate", 0);
        // Quality
        var quality = getConstraintsProperty(constraints, "video.quality", 0);
        // Play resolution
        var playWidth = (typeof options.playWidth !== 'undefined') ? options.playWidth : getConstraintsProperty(constraints, "video.width", 0);
        var playHeight = (typeof options.playHeight !== 'undefined') ? options.playHeight : getConstraintsProperty(constraints, "video.height", 0);
        var stripCodecs = options.stripCodecs || [];
        var resolution = {};

        var published_ = false;
        var record_ = options.record || false;
        var recordFileName = null;
        var cacheLocalResources = options.cacheLocalResources;
        var status_ = STREAM_STATUS.NEW;
        //callbacks added using stream.on()
        var callbacks = {};
        /**
         * Represents media stream.
         *
         * @namespace Stream
         * @see Session~createStream
         */
        var stream = {};
        streamRefreshHandlers[id_] = function(streamInfo, sdp) {
            //set remote sdp
            if (sdp && sdp !== '') {
                var _sdp = sdp;
                if (_codecOptions) _sdp = util.SDP.writeFmtp(sdp, _codecOptions, "opus");
                mediaConnection.setRemoteSdp(_sdp).then(function(){});
                return;
            }
            var event = streamInfo.status;
            if (event == STREAM_STATUS.RESIZE) {
                resolution.width = streamInfo.playerVideoWidth;
                resolution.height = streamInfo.playerVideoHeight;
            } else {
                status_ = event;
            }

            if (event == STREAM_STATUS.PUBLISHING) {
                if (record_) {
                    recordFileName = streamInfo.recordName;
                }
            }

            //release stream
            if (event == STREAM_STATUS.FAILED || event == STREAM_STATUS.STOPPED ||
                event == STREAM_STATUS.UNPUBLISHED) {

                delete streams[id_];
                delete streamRefreshHandlers[id_];
                if (mediaConnection) {
                    mediaConnection.close(cacheLocalResources);
                }
            }
            //fire stream event
            if (callbacks[event]) {
                callbacks[event](stream);
            }
        };

        /**
         * Play stream.
         *
         * @throws {Error} Error if stream status is not {@link Flashphoner.constants.STREAM_STATUS.NEW}
         * @memberof Stream
         * @inner
         */
        var play = function() {
            logger.debug(LOG_PREFIX, "Play stream " + name_);
            if (status_ !== STREAM_STATUS.NEW) {
                throw new Error("Invalid stream state");
            }
            status_ = STREAM_STATUS.PENDING;
            //create mediaProvider connection
            MediaProvider[mediaProvider].createConnection({
                id: id_,
                display: display,
                authToken: authToken,
                mainUrl: urlServer,
                flashBufferTime: options.flashBufferTime || 0
            },streamRefreshHandlers[id_]).then(function(newConnection) {
                mediaConnection = newConnection;
                return mediaConnection.createOffer({
                    receiveAudio: receiveAudio,
                    receiveVideo: receiveVideo,
                    stripCodecs: stripCodecs
                });
            }).then(function (offer) {
                logger.debug(LOG_PREFIX, "Offer SDP:\n" + offer.sdp)
                //request stream with offer sdp from server
                send("playStream", {
                    mediaSessionId: id_,
                    name: name_,
                    published: published_,
                    hasVideo: true,
                    hasAudio: true,
                    status: status_,
                    record: false,
                    width: playWidth,
                    height: playHeight,
                    mediaProvider: mediaProvider,
                    sdp: offer.sdp,
                    custom: options.custom,
                    bitrate: bitrate,
                    quality: quality
                });
                if (offer.player) {
                    offer.player.play(id_);
                }
            }).catch(function(error) {
                //todo fire stream failed status
                throw error;
            });
        };

        /**
         * Publish stream.
         *
         * @throws {Error} Error if stream status is not {@link Flashphoner.constants.STREAM_STATUS.NEW}
         * @memberof Stream
         * @inner
         */
        var publish = function() {
            logger.debug(LOG_PREFIX, "Publish stream " + name_);
            if (status_ !== STREAM_STATUS.NEW) {
                throw new Error("Invalid stream state");
            }
            status_ = STREAM_STATUS.PENDING;
            published_ = true;
            var hasAudio = true;
            if (constraints && constraints.video && constraints.video.type && constraints.video.type == "screen") {
                hasAudio = false;
            }
            //get access to camera
            MediaProvider[mediaProvider].getMediaAccess(constraints, display).then(function(){
                if (status_ == STREAM_STATUS.FAILED) {
                    //stream failed while we were waiting for media access, release media
                    if (!cacheLocalResources) {
                        releaseLocalMedia(display, mediaProvider);
                    }
                    return;
                }
                //create mediaProvider connection
                MediaProvider[mediaProvider].createConnection({
                    id: id_,
                    display: display,
                    authToken: authToken,
                    mainUrl: urlServer,
                }).then(function(newConnection) {
                    mediaConnection = newConnection;
                    return mediaConnection.createOffer({
                        stripCodecs: stripCodecs
                    });
                }).then(function (offer) {
                    logger.debug(LOG_PREFIX, "Offer SDP:\n" + offer.sdp)
                    //publish stream with offer sdp to server
                    send("publishStream", {
                        mediaSessionId: id_,
                        name: name_,
                        published: published_,
                        hasVideo: offer.hasVideo,
                        hasAudio: offer.hasAudio,
                        status: status_,
                        record: record_,
                        mediaProvider: mediaProvider,
                        sdp: offer.sdp,
                        custom: options.custom,
                        bitrate: bitrate
                    });
                });
            }).catch(function(error){
                logger.warn(LOG_PREFIX, error);
                stream.info = error.message;
                status_ = STREAM_STATUS.FAILED;
                //fire stream event
                if (callbacks[status_]) {
                    callbacks[status_](stream);
                }
            });
        };

        /**
         * Stop stream.
         *
         * @memberof Stream
         * @inner
         */
        var stop = function() {
            logger.debug(LOG_PREFIX, "Stop stream " + name_);
            if (status_ == STREAM_STATUS.NEW) {
                //trigger FAILED status
                streamRefreshHandlers[id_]({status: STREAM_STATUS.FAILED});
                return;
            } else if (status_ == STREAM_STATUS.PENDING) {
                logger.warn(LOG_PREFIX, "Stopping stream before server response " + id_);
                setTimeout(stop, 200);
                return;
            } else if (status_ == STREAM_STATUS.FAILED) {
                logger.warn(LOG_PREFIX, "Stream status FAILED");
                return;
            }
            if (published_) {
                send("unPublishStream", {
                    mediaSessionId: id_,
                    name: name_,
                    published: published_,
                    hasVideo: true,
                    hasAudio: true,
                    status: status_,
                    record: false
                });
            } else {
                send("stopStream", {
                    mediaSessionId: id_,
                    name: name_,
                    published: published_,
                    hasVideo: true,
                    hasAudio: true,
                    status: status_,
                    record: false
                });
            }
            //free media provider
            if (mediaConnection) {
                mediaConnection.close(cacheLocalResources);
            }
        };

        /**
         * Get stream status.
         *
         * @returns {string} One of {@link Flashphoner.constants.STREAM_STATUS}
         * @memberof Stream
         * @inner
         */
        var status = function() {
            return status_;
        };

        /**
         * Get stream id.
         *
         * @returns {string} Stream id
         * @memberof Stream
         * @inner
         */
        var id = function() {
            return id_;
        };

        /**
         * Get stream name.
         *
         * @returns {string} Stream name
         * @memberof Stream
         * @inner
         */
        var name = function() {
            return name_;
        };

        /**
         * Is stream published.
         *
         * @returns {Boolean} True if stream published, otherwise false
         * @memberof Stream
         * @inner
         */
        var published = function() {
            return published_;
        };

        /**
         * Get record file name
         * @returns {string} File name
         * @memberof Stream
         * @inner
         */
        var getRecordInfo = function() {
            return recordFileName;
        };

        /**
         * Get stream info
         * @returns {string} Info
         * @memberof Stream
         * @inner
         */
        var getInfo = function() {
            return stream.info;
        };

        /**
         * Get stream video size
         * @returns {Object} Video size
         * @memberof Stream
         * @inner
         */
        var videoResolution = function() {
          if (!published_) {
              return resolution;
          } else {
              throw new Error("This function available only on playing stream");
          }
        };

        /**
         * Media controls
         */

        /**
         * Set volume of remote media
         *
         * @param {number} volume Volume between 0 and 100
         * @memberof Stream
         * @inner
         */
        var setVolume = function(volume) {
            if (mediaConnection) {
                mediaConnection.setVolume(volume);
            }
        };

        /**
         * Get current volume
         *
         * @returns {number} Volume or -1 if audio is not available
         * @memberof Stream
         * @inner
         */
        var getVolume = function() {
            if (mediaConnection) {
                return mediaConnection.getVolume();
            }
            return -1;
        };

        /**
         * Mute outgoing audio
         *
         * @memberof Stream
         * @inner
         */
        var muteAudio = function() {
            if (mediaConnection) {
                mediaConnection.muteAudio();
            }
        };

        /**
         * Unmute outgoing audio
         *
         * @memberof Stream
         * @inner
         */
        var unmuteAudio = function() {
            if (mediaConnection) {
                mediaConnection.unmuteAudio();
            }
        };

        /**
         * Check outgoing audio mute state
         *
         * @returns {boolean} True if audio is muted or not available
         * @memberof Stream
         * @inner
         */
        var isAudioMuted = function() {
            if (mediaConnection) {
                return mediaConnection.isAudioMuted();
            }
            return true;
        };

        /**
         * Mute outgoing video
         *
         * @memberof Stream
         * @inner
         */
        var muteVideo = function() {
            if (mediaConnection) {
                mediaConnection.muteVideo();
            }
        };

        /**
         * Unmute outgoing video
         *
         * @memberof Stream
         * @inner
         */
        var unmuteVideo = function() {
            if (mediaConnection) {
                mediaConnection.unmuteVideo();
            }
        };

        /**
         * Check outgoing video mute state
         *
         * @returns {boolean} True if video is muted or not available
         * @memberof Stream
         * @inner
         */
        var isVideoMuted = function() {
            if (mediaConnection) {
                return mediaConnection.isVideoMuted();
            }
            return true;
        };
        /**
         * Get statistics
         *
         * @returns {Object} Stream audio\video statistics
         * @memberof Stream
         * @inner
         */
        var getStats = function () {
            if (mediaConnection) {
                return mediaConnection.getStats();
            }
        };

        /**
         * Stream event callback.
         *
         * @callback Stream~eventCallback
         * @param {Stream} stream Stream that corresponds to the event
         */

        /**
         * Add stream event callback.
         *
         * @param {string} event One of {@link Flashphoner.constants.STREAM_STATUS} events
         * @param {Stream~eventCallback} callback Callback function
         * @returns {Stream} Stream callback was attached to
         * @throws {TypeError} Error if event is not specified
         * @throws {Error} Error if callback is not a valid function
         * @memberof Stream
         * @inner
         */
        var on = function(event, callback) {
            if (!event) {
                throw new TypeError("Event can't be null");
            }
            if (!callback || typeof callback !== 'function') {
                throw new Error("Callback needs to be a valid function");
            }
            callbacks[event] = callback;
            return stream;
        };

        stream.play = play;
        stream.publish = publish;
        stream.stop = stop;
        stream.id = id;
        stream.status = status;
        stream.name = name;
        stream.published = published;
        stream.getRecordInfo = getRecordInfo;
        stream.getInfo = getInfo;
        stream.videoResolution = videoResolution;
        stream.setVolume = setVolume;
        stream.getVolume = getVolume;
        stream.muteAudio = muteAudio;
        stream.unmuteAudio = unmuteAudio;
        stream.isAudioMuted = isAudioMuted;
        stream.muteVideo = muteVideo;
        stream.unmuteVideo = unmuteVideo;
        stream.isVideoMuted = isVideoMuted;
        stream.getStats = getStats;
        stream.on = on;

        streams[id_] = stream;
        return stream;

    };

    /**
     * Disconnect session.
     *
     * @memberof Session
     * @inner
     */
    var disconnect = function() {
        if (wsConnection) {
            wsConnection.close();
        }
    };

    /**
     * Get session id
     *
     * @returns {string} session id
     * @memberof Session
     * @inner
     */
    var id = function() {
        return id_;
    };

    /**
     * Get server address
     *
     * @returns {string} Server url
     * @memberof Session
     * @inner
     */
    var getServerUrl = function() {
        return urlServer;
    };

    /**
     * Get session status
     *
     * @returns {string} One of {@link Flashphoner.constants.SESSION_STATUS}
     * @memberof Session
     * @inner
     */
    var status = function() {
        return sessionStatus;
    };

    /**
     * Get stream by id.
     *
     * @param {string} streamId Stream id
     * @returns {Stream} Stream
     * @memberof Session
     * @inner
     */
    var getStream = function(streamId) {
        return streams[streamId];
    };

    /**
     * Get streams.
     *
     * @returns {Array<Stream>} Streams
     * @memberof Session
     * @inner
     */
    var getStreams = function() {
        return util.copyObjectToArray(streams);
    };

    /**
     * Submit bug report.
     *
     * @param {Object} reportObject Report object
     * @memberof Session
     * @inner
     */
    var submitBugReport = function(reportObject) {
        send("submitBugReport",reportObject);
    }
    /**
     * Session event callback.
     *
     * @callback Session~eventCallback
     * @param {Session} session Session that corresponds to the event
     */

    /**
     * Add session event callback.
     *
     * @param {string} event One of {@link Flashphoner.constants.SESSION_STATUS} events
     * @param {Session~eventCallback} callback Callback function
     * @returns {Session} Session
     * @throws {TypeError} Error if event is not specified
     * @throws {Error} Error if callback is not a valid function
     * @memberof Session
     * @inner
     */
    var on = function(event, callback) {
        if (!event) {
            throw new Error("Event can't be null", "TypeError");
        }
        if (!callback || typeof callback !== 'function') {
            throw new Error("Callback needs to be a valid function");
        }
        callbacks[event] = callback;
        return session;
    };

    var restAppCommunicator = function() {
        var pending = {};
        var exports = {};
        /**
         * Send data to REST App
         *
         * @param {Object} data Object to send
         * @returns {Promise} Resolves if data accepted, otherwise rejects
         * @memberof Session
         * @name sendData
         * @method
         * @inner
         */
        exports.sendData = function(data) {
            return new Promise(function(resolve, reject){
                var obj = {
                    operationId: uuid.v1(),
                    payload: data
                };
                pending[obj.operationId] = {
                    FAILED: function(info){
                        reject(info);
                    },
                    ACCEPTED: function(info){
                        resolve(info);
                    }
                };
                send("sendData", obj);
            });
        };
        exports.resolveData = function(data) {
            if (pending[data.operationId]) {
                var handler = pending[data.operationId];
                delete pending[data.operationId];
                delete data.operationId;
                handler[data.status](data);
            }
        };
        return exports;
    }();

    //export Session
    session.id = id;
    session.status = status;
    session.getServerUrl = getServerUrl;
    session.createStream = createStream;
    session.createCall = createCall;
    session.getStream = getStream;
    session.getStreams = getStreams;
    session.sendData = restAppCommunicator.sendData;
    session.disconnect = disconnect;
    session.submitBugReport = submitBugReport;
    session.on = on;

    //save interface to global map
    sessions[id_] = session;
    return session;
};

module.exports = {
    init: init,
    getMediaProviders: getMediaProviders,
    getMediaDevices: getMediaDevices,
    getMediaAccess: getMediaAccess,
    releaseLocalMedia: releaseLocalMedia,
    getSessions: getSessions,
    getSession: getSession,
    createSession: createSession,
    playFirstSound: playFirstSound,
    getLogger: getLogger,
    roomApi: require('./room-module'),
    constants: constants,
    firefoxScreenSharingExtensionInstalled: false
};