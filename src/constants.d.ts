/**
 * @namespace Flashphoner.constants.SESSION_STATUS
 * @see Session
*/
export const SESSION_STATUS: Readonly<{
    /**
     * Fires when {@link Session} ws socket opens.
     * @event CONNECTED
     * @memberof Flashphoner.constants.SESSION_STATUS
    */
    CONNECTED: string;
    /**
     * Fires when {@link Session} receives connect ack from REST App.
     * @event ESTABLISHED
     * @memberof Flashphoner.constants.SESSION_STATUS
    */
    ESTABLISHED: string;
    /**
     * Fires when {@link Session} disconnects.
     * @event DISCONNECTED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    DISCONNECTED: string;
    /**
     * Fires if {@link Session} call of rest method error.
     * @event WARN
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    WARN: string;
    /**
     * Fires if {@link Session} connection failed.
     * Some of the reasons can be network connection failed, REST App failed
     * @event FAILED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    FAILED: string;
    /**
     * Fires wneh {@link Session} receives debug event
     * @event DEBUG
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    DEBUG: string;
    /**
     * Fires when {@link Session} receives custom REST App message.
     *
     * @event APP_DATA
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    APP_DATA: string;
    /**
     * Fires when {@link Session} receives status of sendData operation.
     *
     * @event SEND_DATA_STATUS
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    SEND_DATA_STATUS: string;
    /**
     * State of newly created {@link Session}.
     *
     * @event PENDING
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    PENDING: string;
    /**
     * Fires when {@link Session} registers as sip client.
     *
     * @event REGISTERED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    REGISTERED: string;
    /**
     * Fires when {@link Session} unregisters as sip client.
     *
     * @event UNREGISTERED
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    UNREGISTERED: string;
    /**
     * Fires when {@link Session} receives an incoming call.
     *
     * @event INCOMING_CALL
     * @memberof Flashphoner.constants.SESSION_STATUS
     */
    INCOMING_CALL: string;
}>;
/**
 * @namespace Flashphoner.constants.STREAM_STATUS
 * @see Stream
 */
export const STREAM_STATUS: Readonly<{
    /**
     * State of newly created {@link Stream}.
     *
     * @event NEW
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    NEW: string;
    /**
     * State before {@link Stream} publishing/playing.
     *
     * @event PENDING
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PENDING: string;
    /**
     * Fires when {@link Stream} starts publishing.
     * @event PUBLISHING
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PUBLISHING: string;
    /**
     * Fires when {@link Stream} starts playing.
     * @event PLAYING
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PLAYING: string;
    /**
     * Fires if {@link Stream} paused.
     * @event PAUSED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PAUSED: string;
    /**
     * Fires if {@link Stream} was unpublished.
     * @event UNPUBLISHED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    UNPUBLISHED: string;
    /**
     * Fires if playing {@link Stream} was stopped.
     * @event STOPPED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    STOPPED: string;
    /**
     * Fires if {@link Stream} failed.
     * @event FAILED
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    FAILED: string;
    /**
     * Fires if {@link Stream} playback problem.
     * @event PLAYBACK_PROBLEM
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    PLAYBACK_PROBLEM: string;
    /**
     * Fires if playing {@link Stream} picture resizing.
     * @event RESIZE
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    RESIZE: string;
    /**
     * Fires when {@link Stream} snapshot becomes available.
     * Snapshot is base64 encoded png available through {@link Stream.getInfo}
     * @event SNAPSHOT_COMPLETE
     * @memberof Flashphoner.constants.STREAM_STATUS
     */
    SNAPSHOT_COMPLETE: string;
    /**
     * Fires on playing {@link Stream} if bitrate is higher than available network bandwidth.
     * @event NOT_ENOUGH_BANDWIDTH
     * @memberof Flashphoner.constants.NOT_ENOUGH_BANDWIDTH
     */
    NOT_ENOUGH_BANDWIDTH: string;
}>;
/**
 * @namespace Flashphoner.constants.CALL_STATUS
 * @see Call
 */
export const CALL_STATUS: Readonly<{
    /**
     * State of newly created {@link Call}
     * @event NEW
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    NEW: string;
    /**
     * The server is ringing to the callee
     * @event RING
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    RING: string;
    RING_MEDIA: string;
    /**
     * The {@link Call} was put on hold
     * @event HOLD
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    HOLD: string;
    /**
     * The {@link Call} is established
     * @event ESTABLISHED
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    ESTABLISHED: string;
    /**
     * The {@link Call} is finished
     * @event FINISH
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    FINISH: string;
    /**
     * Callee is busy
     * @event BUSY
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    BUSY: string;
    /**
     * SIP session is in progress
     * @event SESSION_PROGRESS
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    SESSION_PROGRESS: string;
    /**
     * The {@link Call} is failed
     * @event FAILED
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    FAILED: string;
    /**
     * The {@link Call} state before ringing
     * @event PENDING
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    PENDING: string;
    /**
     * The server trying to establish {@link Call}
     * @event TRYING
     * @memberof Flashphoner.constants.CALL_STATUS
     */
    TRYING: string;
}>;
/**
* @namespace Flashphoner.constants.STREAM_STATUS_INFO
* @see Stream
*/
export const STREAM_STATUS_INFO: Readonly<{
    /**
     * Indicates general error during ICE negotiation. Usually occurs if client is behind some exotic nat/firewall.
     * @event FAILED_BY_ICE_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_ICE_ERROR: string;
    /**
     * Timeout has been reached during ICE establishment.
     * @event FAILED_BY_ICE_TIMEOUT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_ICE_TIMEOUT: string;
    /**
     * ICE refresh failed on session.
     * @event FAILED_BY_KEEP_ALIVE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_KEEP_ALIVE: string;
    /**
     * DTLS has wrong fingerprint.
     * @event FAILED_BY_DTLS_FINGERPRINT_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_DTLS_FINGERPRINT_ERROR: string;
    /**
     * Client did not send DTLS packets or packets were lost/corrupted during transmission.
     * @event FAILED_BY_DTLS_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_DTLS_ERROR: string;
    /**
     * Indicates general HLS packetizer error, can occur during initialization or packetization (wrong input or out of disk space).
     * @event FAILED_BY_HLS_WRITER_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_HLS_WRITER_ERROR: string;
    /**
     * Indicates general RTMP republishing error, can occur during initialization or rtmp packetization.
     * @event FAILED_BY_RTMP_WRITER_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_RTMP_WRITER_ERROR: string;
    /**
     * RTP session failed by RTP activity timer.
     * @event FAILED_BY_RTP_ACTIVITY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_RTP_ACTIVITY: string;
    /**
     * Related session was disconnected.
     * @event STOPPED_BY_SESSION_DISCONNECT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_SESSION_DISCONNECT: string;
    /**
     * Stream was stopped by rest terminate request.
     * @event STOPPED_BY_REST_TERMINATE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_REST_TERMINATE: string;
    /**
     * Related publisher stopped its stream or lost connection.
     * @event STOPPED_BY_PUBLISHER_STOP
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_PUBLISHER_STOP: string;
    /**
     * Stop the media session by user after call was finished or unpublish stream.
     * @event STOPPED_BY_USER
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STOPPED_BY_USER: string;
    /**
     * Error occurred on the stream.
     * @event FAILED_BY_ERROR
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_BY_ERROR: string;
    /**
     * Indicates that error occurred during media session creation. This might be SDP parsing error, all ports are busy, wrong session related config etc.
     * @event FAILED_TO_ADD_STREAM_TO_PROXY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_ADD_STREAM_TO_PROXY: string;
    /**
     * Stopped shapshot distributor.
     * @event DISTRIBUTOR_STOPPED
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    DISTRIBUTOR_STOPPED: string;
    /**
     * Publish stream is not ready, try again later.
     * @event PUBLISH_STREAM_IS_NOT_READY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    PUBLISH_STREAM_IS_NOT_READY: string;
    /**
     * Stream with this name is not found, check the correct of the name.
     * @event STREAM_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STREAM_NOT_FOUND: string;
    /**
     * Server already has a publish stream with the same name, try using different one.
     * @event STREAM_NAME_ALREADY_IN_USE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STREAM_NAME_ALREADY_IN_USE: string;
    /**
     * Error indicates that stream object received by server has empty mediaSessionId field.
     * @event MEDIASESSION_ID_NULL
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    MEDIASESSION_ID_NULL: string;
    /**
     * Published or subscribed sessions used this MediaSessionId.
     * @event MEDIASESSION_ID_ALREADY_IN_USE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    MEDIASESSION_ID_ALREADY_IN_USE: string;
    /**
     * Session is not initialized or terminated on play ordinary stream.
     * @event SESSION_NOT_READY
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    SESSION_NOT_READY: string;
    /**
     * Actual session does not exist.
     * @event SESSION_DOES_NOT_EXIST
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    SESSION_DOES_NOT_EXIST: string;
    /**
     * RTSP has wrong format on play stream, check the RTSP url validity.
     * @event RTSP_HAS_WRONG_FORMAT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RTSP_HAS_WRONG_FORMAT: string;
    /**
     * Failed to play vod stream, this format is not supported.
     * @event FILE_HAS_WRONG_FORMAT
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FILE_HAS_WRONG_FORMAT: string;
    /**
     * Failed to connect to rtsp stream.
     * @event FAILED_TO_CONNECT_TO_RTSP_STREAM
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_CONNECT_TO_RTSP_STREAM: string;
    /**
     * Rtsp stream is not found, agent received "404-Not Found".
     * @event RTSP_STREAM_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RTSP_STREAM_NOT_FOUND: string;
    /**
     * On shutdown RTSP agent.
     * @event RTSPAGENT_SHUTDOWN
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RTSPAGENT_SHUTDOWN: string;
    /**
     * Stream failed
     * @event STREAM_FAILED
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    STREAM_FAILED: string;
    /**
     * No common codecs on setup track, did not found corresponding trackId->mediaPort.
     * @event NO_COMMON_CODECS
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    NO_COMMON_CODECS: string;
    /**
     * Bad referenced rtsp link, check for correct, example: rtsp://user:b@d_password@127.0.0.1/stream.
     * @event BAD_URI
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    BAD_URI: string;
    /**
     * General VOD error, indicates that Exception occurred while reading/processing media file.
     * @event GOT_EXCEPTION_WHILE_STREAMING_FILE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    GOT_EXCEPTION_WHILE_STREAMING_FILE: string;
    /**
     * Requested stream shutdown.
     * @event REQUESTED_STREAM_SHUTDOWN
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    REQUESTED_STREAM_SHUTDOWN: string;
    /**
     * Failed to create movie, file can not be read.
     * @event FAILED_TO_READ_FILE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_READ_FILE: string;
    /**
     * File does not exist, check filename.
     * @event FILE_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FILE_NOT_FOUND: string;
    /**
     * Server failed to establish websocket connection with origin server.
     * @event FAILED_TO_CONNECT_TO_ORIGIN_STREAM
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_CONNECT_TO_ORIGIN_STREAM: string;
    /**
     * CDN stream not found.
     * @event CDN_STREAM_NOT_FOUND
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    CDN_STREAM_NOT_FOUND: string;
    /**
     * Indicates that provided URL protocol in stream name is invalid.
     * Valid: vod://file.mp4
     * Invalid: dov://file.mp4
     * @event FAILED_TO_GET_AGENT_STORAGE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    FAILED_TO_GET_AGENT_STORAGE: string;
    /**
     * Shutdown agent servicing origin stream.
     * @event AGENT_SERVICING_ORIGIN_STREAM_IS_SHUTTING_DOWN
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    AGENT_SERVICING_ORIGIN_STREAM_IS_SHUTTING_DOWN: string;
    /**
     * Terminated by keep-alive on walk through subscribers.
     * @event TERMINATED_BY_KEEP_ALIVE
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    TERMINATED_BY_KEEP_ALIVE: string;
    /**
     * Transcoding required, but disabled in server settings
     * @event TRANSCODING_REQUIRED_BUT_DISABLED
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    TRANSCODING_REQUIRED_BUT_DISABLED: string;
    /**
     * Access restricted by access list
     * @event RESTRICTED_ACCESS
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    RESTRICTED_ACCESS: string;
    /**
     * No available transcoders for stream
     * @event NO_AVAILABLE_TRANSCODERS
     * @memberof Flashphoner.constants.STREAM_STATUS_INFO
     */
    NO_AVAILABLE_TRANSCODERS: string;
}>;
/**
* @namespace Flashphoner.constants.CALL_STATUS_INFO
* @see Call
*/
export const CALL_STATUS_INFO: Readonly<{
    /**
     * Normal call hangup.
     * @event NORMAL_CALL_CLEARING
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    NORMAL_CALL_CLEARING: string;
    /**
     * Error occurred while creating a session
     * @event FAILED_BY_SESSION_CREATION
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_SESSION_CREATION: string;
    /**
     * Failed by error during ICE establishment.
     * @event FAILED_BY_ICE_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_ICE_ERROR: string;
    /**
     * RTP session failed by RTP activity timer.
     * @event FAILED_BY_RTP_ACTIVITY
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_RTP_ACTIVITY: string;
    /**
     * FF writer was failed on RTMP.
     * @event FAILED_BY_RTMP_WRITER_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_RTMP_WRITER_ERROR: string;
    /**
     * DTLS wrong fingerprint.
     * @event FAILED_BY_DTLS_FINGERPRINT_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_DTLS_FINGERPRINT_ERROR: string;
    /**
     * No common codecs in sdp
     * @event NO_COMMON_CODECS
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    NO_COMMON_CODECS: string;
    /**
     * Client did not send DTLS packets or packets were lost/corrupted during transmission.
     * @event FAILED_BY_DTLS_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_DTLS_ERROR: string;
    /**
     * Error occurred during the call
     * @event FAILED_BY_ERROR
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_ERROR: string;
    /**
     * Call failed by request timeout
     * @event FAILED_BY_REQUEST_TIMEOUT
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    FAILED_BY_REQUEST_TIMEOUT: string;
    /**
     * Transcoding required, but disabled in settings
     * @event TRANSCODING_REQUIRED_BUT_DISABLED
     * @memberof Flashphoner.constants.CALL_STATUS_INFO
     */
    TRANSCODING_REQUIRED_BUT_DISABLED: string;
}>;
/**
* @namespace Flashphoner.constants.ERROR_INFO
*/
export const ERROR_INFO: Readonly<{
    /**
     * Error if none of MediaProviders available
     * @event NONE_OF_MEDIAPROVIDERS_AVAILABLE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    NONE_OF_MEDIAPROVIDERS_AVAILABLE: string;
    /**
     * Error if none of preferred MediaProviders available
     * @event NONE_OF_PREFERRED_MEDIAPROVIDERS_AVAILABLE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    NONE_OF_PREFERRED_MEDIAPROVIDERS_AVAILABLE: string;
    /**
     * Error if API is not initialized
     * @event FLASHPHONER_API_NOT_INITIALIZED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    FLASHPHONER_API_NOT_INITIALIZED: string;
    /**
     * Error if options.urlServer is not specified
     * @event OPTIONS_URLSERVER_MUST_BE_PROVIDED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    OPTIONS_URLSERVER_MUST_BE_PROVIDED: string;
    /**
     * Error if session state is not valid
     * @event INVALID_SESSION_STATE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    INVALID_SESSION_STATE: string;
    /**
     * Error if no options provided
     * @event OPTIONS_MUST_BE_PROVIDED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    OPTIONS_MUST_BE_PROVIDED: string;
    /**
     * Error if call status is not {@link Flashphoner.constants.CALL_STATUS.NEW}
     * @event INVALID_CALL_STATE
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    INVALID_CALL_STATE: string;
    /**
     * Error if event is not specified
     * @event EVENT_CANT_BE_NULL
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    EVENT_CANT_BE_NULL: string;
    /**
     * Error if callback is not a valid function
     * @event CALLBACK_NEEDS_TO_BE_A_VALID_FUNCTION
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    CALLBACK_NEEDS_TO_BE_A_VALID_FUNCTION: string;
    /**
     * Error if options.name is not specified
     * @event OPTIONS_NAME_MUST_BE_PROVIDED
     * @memberof Flashphoner.constants.ERROR_INFO
     */
    OPTIONS_NAME_MUST_BE_PROVIDED: string;
    /**
     * Error if number of cams is less than 2 or camera is already used by other application
     * @event CAN_NOT_SWITCH_CAM
     * @memberOf Flashphoner.constants.ERROR_INFO
     */
    CAN_NOT_SWITCH_CAM: string;
    /**
     * Error if number of mics is less than 2 or microphone is already used by other application
     * @event CAN_NOT_SWITCH_MIC
     * @memberOf Flashphoner.constants.ERROR_INFO
     */
    CAN_NOT_SWITCH_MIC: string;
    /**
     * Local browser error detected
     * @event LOCAL_ERROR
     * @memberOf Flashphoner.constants.ERROR_INFO
     */
    LOCAL_ERROR: string;
}>;
/**
 * Local media devices type
 * @namespace Flashphoner.constants.MEDIA_DEVICE_KIND
 */
export const MEDIA_DEVICE_KIND: Readonly<{
    /**
     * List local media output devices
     * @see Flashphoner.getMediaDevices
     * @memberOf Flashphoner.constants.MEDIA_DEVICE_KIND
     */
    OUTPUT: string;
    /**
     * List local media input devices
     * @see Flashphoner.getMediaDevices
     * @memberOf Flashphoner.constants.MEDIA_DEVICE_KIND
     */
    INPUT: string;
    /**
     * List local media devices
     * @see Flashphoner.getMediaDevices
     * @memberOf Flashphoner.constants.MEDIA_DEVICE_KIND
     */
    ALL: string;
}>;
/**
 * WebRTC transport type
 * @namespace Flashphoner.constants.TRANSPORT_TYPE
 */
export const TRANSPORT_TYPE: Readonly<{
    /**
     * WebRTC RTP traffic goes over UDP (default)
     * @see Stream
     * @memberOf Flashphoner.constants.TRANSPORT_TYPE
     */
    UDP: string;
    /**
     * WebRTC RTP traffic goes over TCP
     * @see Stream
     * @memberOf Flashphoner.constants.TRANSPORT_TYPE
     */
    TCP: string;
}>;
/**
 * WebRTC connection quality type
 * @namespace Flashphoner.constants.CONNECTION_QUALITY
 */
export const CONNECTION_QUALITY: Readonly<{
    /**
     * Channel bandwidth is perfect
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    PERFECT: string;
    /**
     * Channel bandwidth is good
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    GOOD: string;
    /**
     * Channel bandwidth is bad
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    BAD: string;
    /**
     * Channel bandwidth is unknown (initial state)
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    UNKNOWN: string;
    /**
     * Channel bandwidth is updating
     * @see Stream
     * @memberOf Flashphoner.constants.CONNECTION_QUALITY
     */
    UPDATE: string;
}>;
/**
 * Websocket signaling stream event
 * @see Stream
 * @memberOf Flashphoner.constants
 */
export const STREAM_EVENT: "STREAM_EVENT";
/**
 * Websocket signaling stream event type
 * @namespace Flashphoner.constants.STREAM_EVENT_TYPE
 */
export const STREAM_EVENT_TYPE: Readonly<{
    /**
     * Stream audio is muted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    AUDIO_MUTED: string;
    /**
     * Stream audio is unmuted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    AUDIO_UNMUTED: string;
    /**
     * Stream video is muted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    VIDEO_MUTED: string;
    /**
     * Stream videoo is unmuted
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    VIDEO_UNMUTED: string;
    /**
     * Data bound to the stream are received
     * @see Stream
     * @memberOf Flashphoner.constants.STREAM_EVENT_TYPE
     */
    DATA: string;
}>;
/**
 * WebRTC video content hint type
 * @namespace Flashphoner.constants.CONTENT_HINT_TYPE
 */
export const CONTENT_HINT_TYPE: Readonly<{
    /**
     * Video content is motion (webcam case): keep FPS, resolution and bitrate may change
     * @see Stream
     * @memberOf Flashphoner.constants.CONTENT_HINT_TYPE
     */
    MOTION: string;
    /**
     * Video content is detail (sreen sharing case): keep resolution, bitrate may change, FPS may drop
     * @see Stream
     * @memberOf Flashphoner.constants.CONTENT_HINT_TYPE
     */
    DETAIL: string;
    /**
     * Video content is text (sreen sharing case): keep resolution and bitrate, FPS may drop
     * @see Stream
     * @memberOf Flashphoner.constants.CONTENT_HINT_TYPE
     */
    TEXT: string;
}>;
