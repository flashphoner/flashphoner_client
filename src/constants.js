'use strict';
/**
 * @namespace Flashphoner.constants.SESSION_STATUS
 * @see Session
 */
const SESSION_STATUS = Object.freeze({
    /**
     * Fires when {@link Session} ws socket opens.
     * @event CONNECTED
     * @memberof Flashphoner.constants.SESSION_STATUS
    */
    CONNECTED: 'CONNECTED',
    /**
     * Fires when {@link Session} receives connect ack from REST App.
     * @event ESTABLISHED
     * @memberof Flashphoner.constants.SESSION_STATUS
    */
    ESTABLISHED: 'ESTABLISHED',
    /**
     * Fires when {@link Session} disconnects.
     * @event DISCONNECTED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    DISCONNECTED: 'DISCONNECTED',
    /**
     * Fires if {@link Session} call of rest method error.
     * @event WARN
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    WARN: 'WARN',
    /**
     * Fires if {@link Session} connection failed.
     * Some of the reasons can be network connection failed, REST App failed
     * @event FAILED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    FAILED: 'FAILED',
    /**
     * Fires wneh {@link Session} receives debug event
     * @event DEBUG
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    DEBUG: 'DEBUG',
    /**
     * Fires when {@link Session} receives custom REST App message.
     *
     * @event APP_DATA
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    APP_DATA: 'APP_DATA',
    /**
     * Fires when {@link Session} receives status of sendData operation.
     *
     * @event SEND_DATA_STATUS
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    SEND_DATA_STATUS: 'SEND_DATA_STATUS',
    /**
     * State of newly created {@link Session}.
     *
     * @event PENDING
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    PENDING: 'PENDING',
    /**
     * Fires when {@link Session} registers as sip client.
     *
     * @event REGISTERED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    REGISTERED: 'REGISTERED',
    /**
     * Fires when {@link Session} unregisters as sip client.
     *
     * @event UNREGISTERED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    UNREGISTERED: 'UNREGISTERED',
    /**
     * Fires when {@link Session} receives an incoming call.
     *
     * @event INCOMING_CALL
     * @memberof Flashphoner.constants.SESSION_STATUS
     */        
    INCOMING_CALL: 'INCOMING_CALL'
});

/**
 * @namespace Flashphoner.constants.STREAM_STATUS
 * @see Stream
 */
const STREAM_STATUS = Object.freeze({
    /**
     * State of newly created {@link Stream}.
     *
     * @event NEW
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    NEW: 'NEW',
    /**
     * State before {@link Stream} publishing/playing.
     *
     * @event PENDING
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PENDING: 'PENDING',
    /**
     * Fires when {@link Stream} starts publishing.
     * @event PUBLISHING
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PUBLISHING: 'PUBLISHING',
    /**
     * Fires when {@link Stream} starts playing.
     * @event PLAYING
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PLAYING: 'PLAYING',
    /**
     * Fires if {@link Stream} paused.
     * @event PAUSED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PAUSED: 'PAUSED',
    /**
     * Fires if {@link Stream} was unpublished.
     * @event UNPUBLISHED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    UNPUBLISHED: 'UNPUBLISHED',
    /**
     * Fires if playing {@link Stream} was stopped.
     * @event STOPPED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    STOPPED: 'STOPPED',
    /**
     * Fires if {@link Stream} failed.
     * @event FAILED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    FAILED: 'FAILED',
    /**
     * Fires if {@link Stream} playback problem.
     * @event PLAYBACK_PROBLEM
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PLAYBACK_PROBLEM: 'PLAYBACK_PROBLEM',
    /**
     * Fires if playing {@link Stream} picture resizing.
     * @event RESIZE
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    RESIZE: 'RESIZE',
    /**
     * Fires when {@link Stream} snapshot becomes available.
     * Snapshot is base64 encoded png available through {@link Stream.getInfo}
     * @event SNAPSHOT_COMPLETE
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    SNAPSHOT_COMPLETE: 'SNAPSHOT_COMPLETE',
    /**
     * Fires on playing {@link Stream} if bitrate is higher than available network bandwidth.
     * @event NOT_ENOUGH_BANDWIDTH
     * @memberof Flashphoner.constants.NOT_ENOUGH_BANDWIDTH
     */
    NOT_ENOUGH_BANDWIDTH: 'NOT_ENOUGH_BANDWIDTH'
});

/**
 * @namespace Flashphoner.constants.CALL_STATUS
 * @see Call
 */
const CALL_STATUS = Object.freeze({
    /**
     * State of newly created {@link Call}
     * @event NEW
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    NEW: 'NEW',
    /**
     * The server is ringing to the callee
     * @event RING
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    RING: 'RING',
    RING_MEDIA: 'RING_MEDIA',
    /**
     * The {@link Call} was put on hold
     * @event HOLD
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    HOLD: 'HOLD',
    /**
     * The {@link Call} is established
     * @event ESTABLISHED
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    ESTABLISHED: 'ESTABLISHED',
    /**
     * The {@link Call} is finished
     * @event FINISH
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    FINISH: 'FINISH',
    /**
     * Callee is busy
     * @event BUSY
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    BUSY: 'BUSY',
    /**
     * SIP session is in progress
     * @event SESSION_PROGRESS
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    SESSION_PROGRESS: 'SESSION_PROGRESS',
    /**
     * The {@link Call} is failed
     * @event FAILED
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    FAILED: 'FAILED',
    /**
     * The {@link Call} state before ringing
     * @event PENDING
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    PENDING: 'PENDING',
    /**
     * The server trying to establish {@link Call}
     * @event TRYING
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    TRYING: 'TRYING'
});

/**
* @namespace Flashphoner.constants.STREAM_STATUS_INFO
* @see Stream
*/
const STREAM_STATUS_INFO = Object.freeze({
    /**
     * Indicates general error during ICE negotiation. Usually occurs if client is behind some exotic nat/firewall.
     * @event FAILED_BY_ICE_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_ICE_ERROR: 'Failed by ICE error',
    /**
     * Timeout has been reached during ICE establishment.
     * @event FAILED_BY_ICE_TIMEOUT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_ICE_TIMEOUT: 'Failed by ICE timeout',
    /**
     * ICE refresh failed on session.
     * @event FAILED_BY_KEEP_ALIVE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_KEEP_ALIVE: 'Failed by ICE keep alive',
    /**
     * DTLS has wrong fingerprint.
     * @event FAILED_BY_DTLS_FINGERPRINT_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_DTLS_FINGERPRINT_ERROR: 'Failed by DTLS fingerprint error',
    /**
     * Client did not send DTLS packets or packets were lost/corrupted during transmission.
     * @event FAILED_BY_DTLS_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_DTLS_ERROR: 'Failed by DTLS error',
    /**
     * Indicates general HLS packetizer error, can occur during initialization or packetization (wrong input or out of disk space).
     * @event FAILED_BY_HLS_WRITER_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_HLS_WRITER_ERROR: 'Failed by HLS writer error',
    /**
     * Indicates general RTMP republishing error, can occur during initialization or rtmp packetization.
     * @event FAILED_BY_RTMP_WRITER_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_RTMP_WRITER_ERROR: 'Failed by RTMP writer error',
    /**
     * RTP session failed by RTP activity timer.
     * @event FAILED_BY_RTP_ACTIVITY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_RTP_ACTIVITY: 'Failed by RTP activity',
    /**
     * Related session was disconnected.
     * @event STOPPED_BY_SESSION_DISCONNECT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_SESSION_DISCONNECT: 'Stopped by session disconnect',
    /**
     * Stream was stopped by rest terminate request.
     * @event STOPPED_BY_REST_TERMINATE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_REST_TERMINATE: 'Stopped by rest /terminate',
    /**
     * Related publisher stopped its stream or lost connection.
     * @event STOPPED_BY_PUBLISHER_STOP
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_PUBLISHER_STOP: 'Stopped by publisher stop',
    /**
     * Stop the media session by user after call was finished or unpublish stream.
     * @event STOPPED_BY_USER
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_USER: 'Stopped by user',
    /**
     * Error occurred on the stream.
     * @event FAILED_BY_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_ERROR: 'Failed by error',
    /**
     * Indicates that error occurred during media session creation. This might be SDP parsing error, all ports are busy, wrong session related config etc.
     * @event FAILED_TO_ADD_STREAM_TO_PROXY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_ADD_STREAM_TO_PROXY: 'Failed to add stream to proxy',
    /**
     * Stopped shapshot distributor.
     * @event DISTRIBUTOR_STOPPED
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    DISTRIBUTOR_STOPPED: 'Distributor stopped',
    /**
     * Publish stream is not ready, try again later.
     * @event PUBLISH_STREAM_IS_NOT_READY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    PUBLISH_STREAM_IS_NOT_READY: 'Publish stream is not ready',
    /**
     * Stream with this name is not found, check the correct of the name.
     * @event STREAM_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STREAM_NOT_FOUND: 'Stream not found',
    /**
     * Server already has a publish stream with the same name, try using different one.
     * @event STREAM_NAME_ALREADY_IN_USE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STREAM_NAME_ALREADY_IN_USE: 'Stream name is already in use',
    /**
     * Error indicates that stream object received by server has empty mediaSessionId field.
     * @event MEDIASESSION_ID_NULL
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    MEDIASESSION_ID_NULL: 'MediaSessionId is null',
    /**
     * Published or subscribed sessions used this MediaSessionId.
     * @event MEDIASESSION_ID_ALREADY_IN_USE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    MEDIASESSION_ID_ALREADY_IN_USE: 'MediaSessionId is already in use',
    /**
     * Session is not initialized or terminated on play ordinary stream.
     * @event SESSION_NOT_READY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    SESSION_NOT_READY: 'Session not ready',
    /**
     * Actual session does not exist.
     * @event SESSION_DOES_NOT_EXIST
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    SESSION_DOES_NOT_EXIST: 'Session does not exist',
    /**
     * RTSP has wrong format on play stream, check the RTSP url validity.
     * @event RTSP_HAS_WRONG_FORMAT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RTSP_HAS_WRONG_FORMAT: 'Rtsp has wrong format',
    /**
     * Failed to play vod stream, this format is not supported.
     * @event FILE_HAS_WRONG_FORMAT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FILE_HAS_WRONG_FORMAT: 'File has wrong format',
    /**
     * Failed to connect to rtsp stream.
     * @event FAILED_TO_CONNECT_TO_RTSP_STREAM
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_CONNECT_TO_RTSP_STREAM: 'Failed to connect to rtsp stream',
    /**
     * Rtsp stream is not found, agent received "404-Not Found".
     * @event RTSP_STREAM_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RTSP_STREAM_NOT_FOUND: 'Rtsp stream not found',
    /**
     * On shutdown RTSP agent.
     * @event RTSPAGENT_SHUTDOWN
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RTSPAGENT_SHUTDOWN: 'RtspAgent shutdown',
    /**
     * Stream failed
     * @event STREAM_FAILED
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STREAM_FAILED: 'Stream failed',
    /**
     * No common codecs on setup track, did not found corresponding trackId->mediaPort.
     * @event NO_COMMON_CODECS
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    NO_COMMON_CODECS: 'No common codecs',
    /**
     * Bad referenced rtsp link, check for correct, example: rtsp://user:b@d_password@127.0.0.1/stream.
     * @event BAD_URI
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    BAD_URI: 'Bad URI',
    /**
     * General VOD error, indicates that Exception occurred while reading/processing media file.
     * @event GOT_EXCEPTION_WHILE_STREAMING_FILE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    GOT_EXCEPTION_WHILE_STREAMING_FILE: 'Got exception while streaming file',
    /**
     * Requested stream shutdown.
     * @event REQUESTED_STREAM_SHUTDOWN
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    REQUESTED_STREAM_SHUTDOWN: 'Requested stream shutdown',
    /**
     * Failed to create movie, file can not be read.
     * @event FAILED_TO_READ_FILE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_READ_FILE: 'Failed to read file',
    /**
     * File does not exist, check filename.
     * @event FILE_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FILE_NOT_FOUND: 'File not found',
    /**
     * Server failed to establish websocket connection with origin server.
     * @event FAILED_TO_CONNECT_TO_ORIGIN_STREAM
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_CONNECT_TO_ORIGIN_STREAM: 'Failed to connect to origin stream',
    /**
     * CDN stream not found.
     * @event CDN_STREAM_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    CDN_STREAM_NOT_FOUND: 'CDN stream not found',
    /**
     * Indicates that provided URL protocol in stream name is invalid.
     * Valid: vod://file.mp4
     * Invalid: dov://file.mp4
     * @event FAILED_TO_GET_AGENT_STORAGE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_GET_AGENT_STORAGE: 'Failed to get agent storage',
    /**
     * Shutdown agent servicing origin stream.
     * @event AGENT_SERVICING_ORIGIN_STREAM_IS_SHUTTING_DOWN
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    AGENT_SERVICING_ORIGIN_STREAM_IS_SHUTTING_DOWN: 'Agent servicing origin stream is shutting down',
    /**
     * Terminated by keep-alive on walk through subscribers.
     * @event TERMINATED_BY_KEEP_ALIVE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    TERMINATED_BY_KEEP_ALIVE: 'Terminated by keep-alive',
    /**
     * Transcoding required, but disabled in server settings
     * @event TRANSCODING_REQUIRED_BUT_DISABLED
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    TRANSCODING_REQUIRED_BUT_DISABLED: 'Transcoding required, but disabled',
    /**
     * Access restricted by access list
     * @event RESTRICTED_ACCESS
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RESTRICTED_ACCESS: 'Restricted access',
    /**
     * No available transcoders for stream
     * @event NO_AVAILABLE_TRANSCODERS
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    NO_AVAILABLE_TRANSCODERS: 'No available transcoders'
});

/**
* @namespace Flashphoner.constants.CALL_STATUS_INFO
* @see Call
*/
const CALL_STATUS_INFO = Object.freeze({
    /**
     * Normal call hangup.
     * @event NORMAL_CALL_CLEARING
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    NORMAL_CALL_CLEARING: 'Normal call clearing',
    /**
     * Error occurred while creating a session
     * @event FAILED_BY_SESSION_CREATION
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_SESSION_CREATION: 'Failed by session creation',
    /**
     * Failed by error during ICE establishment.
     * @event FAILED_BY_ICE_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_ICE_ERROR: 'Failed by ICE error',
    /**
     * RTP session failed by RTP activity timer.
     * @event FAILED_BY_RTP_ACTIVITY
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_RTP_ACTIVITY: 'Failed by RTP activity',
    /**
     * FF writer was failed on RTMP.
     * @event FAILED_BY_RTMP_WRITER_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_RTMP_WRITER_ERROR: 'Failed by RTMP writer error',
    /**
     * DTLS wrong fingerprint.
     * @event FAILED_BY_DTLS_FINGERPRINT_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_DTLS_FINGERPRINT_ERROR: 'Failed by DTLS fingerprint error',
    /**
     * No common codecs in sdp
     * @event NO_COMMON_CODECS
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    NO_COMMON_CODECS: 'No common codecs',
    /**
     * Client did not send DTLS packets or packets were lost/corrupted during transmission.
     * @event FAILED_BY_DTLS_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_DTLS_ERROR: 'Failed by DTLS error',
    /**
     * Error occurred during the call
     * @event FAILED_BY_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_ERROR: 'Failed by error',
    /**
     * Call failed by request timeout
     * @event FAILED_BY_REQUEST_TIMEOUT
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_REQUEST_TIMEOUT: 'Failed by request timeout',
    /**
     * Transcoding required, but disabled in settings
     * @event TRANSCODING_REQUIRED_BUT_DISABLED
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    TRANSCODING_REQUIRED_BUT_DISABLED: 'Transcoding required, but disabled'
});

/**
* @namespace Flashphoner.constants.ERROR_INFO
*/
const ERROR_INFO = Object.freeze({
    /**
     * Error if none of MediaProviders available
     * @event NONE_OF_MEDIAPROVIDERS_AVAILABLE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    NONE_OF_MEDIAPROVIDERS_AVAILABLE: 'None of MediaProviders available',
    /**
     * Error if none of preferred MediaProviders available
     * @event NONE_OF_PREFERRED_MEDIAPROVIDERS_AVAILABLE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    NONE_OF_PREFERRED_MEDIAPROVIDERS_AVAILABLE: 'None of preferred MediaProviders available',
    /**
     * Error if API is not initialized
     * @event FLASHPHONER_API_NOT_INITIALIZED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    FLASHPHONER_API_NOT_INITIALIZED: 'Flashphoner API is not initialized',
    /**
     * Error if options.urlServer is not specified
     * @event OPTIONS_URLSERVER_MUST_BE_PROVIDED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    OPTIONS_URLSERVER_MUST_BE_PROVIDED: 'options.urlServer must be provided',
    /**
     * Error if session state is not valid
     * @event INVALID_SESSION_STATE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    INVALID_SESSION_STATE: 'Invalid session state',
    /**
     * Error if no options provided
     * @event OPTIONS_MUST_BE_PROVIDED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    OPTIONS_MUST_BE_PROVIDED: 'options must be provided',
    /**
     * Error if call status is not {@link Flashphoner.constants.CALL_STATUS.NEW}
     * @event INVALID_CALL_STATE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    INVALID_CALL_STATE: 'Invalid call state',
    /**
     * Error if event is not specified
     * @event EVENT_CANT_BE_NULL
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    EVENT_CANT_BE_NULL: 'Event can\'t be null',
    /**
     * Error if callback is not a valid function
     * @event CALLBACK_NEEDS_TO_BE_A_VALID_FUNCTION
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    CALLBACK_NEEDS_TO_BE_A_VALID_FUNCTION: 'Callback needs to be a valid function', 
    /**
     * Error if options.name is not specified
     * @event OPTIONS_NAME_MUST_BE_PROVIDED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    OPTIONS_NAME_MUST_BE_PROVIDED: 'options.name must be provided',
    /**
     * Error if number of cams is less than 2 or camera is already used by other application
     * @event CAN_NOT_SWITCH_CAM
     * @memberOf Flashphoner.constants.ERROR_INFO
     */
    CAN_NOT_SWITCH_CAM: 'Number of cams is less than 2 or camera is already used by other application',
    /**
     * Error if number of mics is less than 2 or microphone is already used by other application
     * @event CAN_NOT_SWITCH_MIC
     * @memberOf Flashphoner.constants.ERROR_INFO
     */
    CAN_NOT_SWITCH_MIC: 'Number of mics is less than 2 or microphone is already used by other application',
    /**
     * Local browser error detected
     * @event LOCAL_ERROR
     * @memberOf Flashphoner.constants.ERROR_INFO
     */
    LOCAL_ERROR: 'Local error'
});

/**
 * Local media devices type
 * @namespace Flashphoner.constants.MEDIA_DEVICE_KIND
 */
const MEDIA_DEVICE_KIND = Object.freeze({
    /**
     * List local media output devices
     * @see Flashphoner.getMediaDevices
     * @memberOf Flashphoner.constants.MEDIA_DEVICE_KIND
     */
    OUTPUT: 'output',
    /**
     * List local media input devices
     * @see Flashphoner.getMediaDevices
     * @memberOf Flashphoner.constants.MEDIA_DEVICE_KIND
     */
    INPUT: 'input',
    /**
     * List local media devices
     * @see Flashphoner.getMediaDevices
     * @memberOf Flashphoner.constants.MEDIA_DEVICE_KIND
     */
    ALL: 'all'
});

/**
 * WebRTC transport type
 * @namespace Flashphoner.constants.TRANSPORT_TYPE
 */
const TRANSPORT_TYPE = Object.freeze({
    /**
     * WebRTC RTP traffic goes over UDP (default)
     * @see Stream
     * @memberOf Flashphoner.constants.TRANSPORT_TYPE
     */
    UDP: 'UDP',
    /**
     * WebRTC RTP traffic goes over TCP
     * @see Stream
     * @memberOf Flashphoner.constants.TRANSPORT_TYPE
     */
    TCP: 'TCP'
});

/**
 * WebRTC connection quality type
 * @namespace Flashphoner.constants.CONNECTION_QUALITY
 */
const CONNECTION_QUALITY = Object.freeze({
    /**
     * Channel bandwidth is perfect
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    PERFECT: 'PERFECT',
    /**
     * Channel bandwidth is good
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    GOOD: 'GOOD',
    /**
     * Channel bandwidth is bad
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    BAD: 'BAD',
    /**
     * Channel bandwidth is unknown (initial state)
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    UNKNOWN: 'UNKNOWN',
    /**
     * Channel bandwidth is updating
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    UPDATE: 'UPDATE'
});

/**
 * Websocket signaling stream event
 * @see Stream
 * @memberOf Flashphoner.constants
 */
const STREAM_EVENT = 'STREAM_EVENT';

/**
 * Websocket signaling stream event type
 * @namespace Flashphoner.constants.STREAM_EVENT_TYPE
 */
const STREAM_EVENT_TYPE = Object.freeze({
    /**
     * Stream audio is muted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    AUDIO_MUTED: 'audioMuted',
    /**
     * Stream audio is unmuted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    AUDIO_UNMUTED: 'audioUnmuted',
    /**
     * Stream video is muted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    VIDEO_MUTED: 'videoMuted',
    /**
     * Stream videoo is unmuted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    VIDEO_UNMUTED: 'videoUnmuted',
    /**
     * Data bound to the stream are received
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    DATA: 'data'
});

/**
 * WebRTC video content hint type
 * @namespace Flashphoner.constants.CONTENT_HINT_TYPE
 */
const CONTENT_HINT_TYPE = Object.freeze({
    /**
     * Video content is motion (webcam case): keep FPS, resolution and bitrate may change
     * @see Stream
     * @memberOf Flashphoner.constants.CONTENT_HINT_TYPE
     */
    MOTION: 'motion',
    /**
     * Video content is detail (sreen sharing case): keep resolution, bitrate may change, FPS may drop
     * @see Stream
     * @memberOf Flashphoner.constants.CONTENT_HINT_TYPE
     */
    DETAIL: 'detail',
    /**
     * Video content is text (sreen sharing case): keep resolution and bitrate, FPS may drop
     * @see Stream
     * @memberOf Flashphoner.constants.CONTENT_HINT_TYPE
     */
    TEXT: 'text'
});

module.exports = {
    SESSION_STATUS,
    STREAM_STATUS,
    CALL_STATUS,
    STREAM_STATUS_INFO,
    CALL_STATUS_INFO,
    ERROR_INFO,
    MEDIA_DEVICE_KIND,
    TRANSPORT_TYPE,
    CONNECTION_QUALITY,
    STREAM_EVENT,
    STREAM_EVENT_TYPE,
    CONTENT_HINT_TYPE
};
