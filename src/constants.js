'use strict';

/**
 * @namespace Flashphoner.constants.SESSION_STATUS
 * @see Session
 */
var sessionStatus = {};

/**
 * Fires when {@link Session} ws socket opens.
 * @event CONNECTED
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'CONNECTED', 'CONNECTED');

/**
 * Fires when {@link Session} receives connect ack from REST App.
 * @event ESTABLISHED
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'ESTABLISHED', 'ESTABLISHED');

/**
 * Fires when {@link Session} disconnects.
 * @event DISCONNECTED
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'DISCONNECTED', 'DISCONNECTED');

/**
 * Fires if {@link Session} call of rest method error.
 * @event WARN
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'WARN', 'WARN');

/**
 * Fires if {@link Session} connection failed.
 * Some of the reasons can be network connection failed, REST App failed
 * @event FAILED
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'FAILED', 'FAILED');

/**
 * Fires wneh {@link Session} receives debug event
 * @event DEBUG
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'DEBUG', 'DEBUG');

/**
 * Fires when {@link Session} receives custom REST App message.
 *
 * @event APP_DATA
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'APP_DATA', 'APP_DATA');

/**
 * Fires when {@link Session} receives status of sendData operation.
 *
 * @event SEND_DATA_STATUS
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'SEND_DATA_STATUS', 'SEND_DATA_STATUS');

//State of newly created Session
define(sessionStatus, 'PENDING', 'PENDING');

/**
 * Fires when {@link Session} registers as sip client.
 *
 * @event APP_DATA
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'REGISTERED', 'REGISTERED');

/**
 * Fires when {@link Session} unregisters as sip client.
 *
 * @event APP_DATA
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'UNREGISTERED', 'UNREGISTERED');

define(sessionStatus, 'INCOMING_CALL', 'INCOMING_CALL');

/**
 * @namespace Flashphoner.constants.STREAM_STATUS
 * @see Stream
 */
var streamStatus = {};
//State of newly created Stream
define(streamStatus, 'NEW', 'NEW');
//State between publish/play and server response
define(streamStatus, 'PENDING', 'PENDING');

/**
 * Fires when {@link Stream} starts publishing.
 * @event PUBLISHING
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PUBLISHING', 'PUBLISHING');

/**
 * Fires when {@link Stream} starts playing.
 * @event PLAYING
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PLAYING', 'PLAYING');

/**
 * Fires if {@link Stream} paused.
 * @event PAUSED
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PAUSED', 'PAUSED');

/**
 * Fires if {@link Stream} was unpublished.
 * @event UNPUBLISHING
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'UNPUBLISHED', 'UNPUBLISHED');

/**
 * Fires if {@link Stream} was stopped.
 * @event STOPPED
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'STOPPED', 'STOPPED');

/**
 * Fires if {@link Stream} failed.
 * @event FAILED
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'FAILED', 'FAILED');

/**
 * Fires if {@link Stream} playback problem.
 * @event PLAYBACK_PROBLEM
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PLAYBACK_PROBLEM', 'PLAYBACK_PROBLEM');

/**
 * Fires if {@link Stream} resize.
 * @event RESIZE
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'RESIZE', 'RESIZE');

/**
 * Fires when {@link Stream} snapshot becomes available.
 * Snapshot is base64 encoded png available through {@link Stream.getInfo}
 * @event SNAPSHOT_COMPLETE
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'SNAPSHOT_COMPLETE', 'SNAPSHOT_COMPLETE');

/**
 * Fires on subscribe {@link Stream} if bitrate is higher than available network bandwidth.
 * @event NOT_ENOUGH_BANDWIDTH
 * @memberof Flashphoner.constants.NOT_ENOUGH_BANDWIDTH
 */
define(streamStatus, 'NOT_ENOUGH_BANDWIDTH', 'NOT_ENOUGH_BANDWIDTH');

/**
 * @namespace Flashphoner.constants.CALL_STATUS
 * @see Call
 */
var callStatus = {};
//State of newly created Call
define(callStatus, 'NEW', 'NEW');
define(callStatus, 'RING', 'RING');
define(callStatus, 'RING_MEDIA', 'RING_MEDIA');
define(callStatus, 'HOLD', 'HOLD');
define(callStatus, 'ESTABLISHED', 'ESTABLISHED');
define(callStatus, 'FINISH', 'FINISH');
define(callStatus, 'BUSY', 'BUSY');
define(callStatus, 'SESSION_PROGRESS', 'SESSION_PROGRESS');
define(callStatus, 'FAILED', 'FAILED');
define(callStatus, 'PENDING', 'PENDING');
define(callStatus, 'TRYING', 'TRYING');

/**
* @namespace Flashphoner.constants.STREAM_STATUS_INFO
* @see Stream
*/
var streamStatusInfo = {};

/**
 * Indicates general error during ICE negotiation. Usually occurs if client is behind some exotic nat/firewall.
 * @event FAILED_BY_ICE_ERROR
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_ICE_ERROR', 'Failed by ICE error');

/**
 * Timeout has been reached during ICE establishment.
 * @event FAILED_BY_ICE_TIMEOUT
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_ICE_TIMEOUT', 'Failed by ICE timeout');

/**
 * ICE refresh failed on session.
 * @event FAILED_BY_KEEP_ALIVE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_KEEP_ALIVE', 'Failed by ICE keep alive');

/**
 * DTLS has wrong fingerprint.
 * @event FAILED_BY_DTLS_FINGERPRINT_ERROR
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_DTLS_FINGERPRINT_ERROR', 'Failed by DTLS fingerprint error');

/**
 * Client did not send DTLS packets or packets were lost/corrupted during transmission.
 * @event FAILED_BY_DTLS_ERROR
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_DTLS_ERROR', 'Failed by DTLS error');

/**
 * Indicates general HLS packetizer error, can occur during initialization or packetization (wrong input or out of disk space).
 * @event FAILED_BY_HLS_WRITER_ERROR
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_HLS_WRITER_ERROR', 'Failed by HLS writer error');

/**
 * Indicates general RTMP republishing error, can occur during initialization or rtmp packetization.
 * @event FAILED_BY_RTMP_WRITER_ERROR
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_RTMP_WRITER_ERROR', 'Failed by RTMP writer error');

/**
 * RTP session failed by RTP activity timer.
 * @event FAILED_BY_RTP_ACTIVITY
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_RTP_ACTIVITY', 'Failed by RTP activity');

/**
 * Related session was disconnected.
 * @event STOPPED_BY_SESSION_DISCONNECT
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'STOPPED_BY_SESSION_DISCONNECT', 'Stopped by session disconnect');

/**
 * Stream was stopped by rest terminate request.
 * @event STOPPED_BY_REST_TERMINATE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'STOPPED_BY_REST_TERMINATE', 'Stopped by rest /terminate');

/**
 * Related publisher stopped its stream or lost connection.
 * @event STOPPED_BY_PUBLISHER_STOP
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'STOPPED_BY_PUBLISHER_STOP', 'Stopped by publisher stop');

/**
 * Stop the media session by user after call was finished or unpublish stream.
 * @event STOPPED_BY_USER
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'STOPPED_BY_USER', 'Stopped by user');

/**
 * Error occurred on the stream.
 * @event FAILED_BY_ERROR
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_BY_ERROR', 'Failed by error');

/**
 * Indicates that error occurred during media session creation. This might be SDP parsing error, all ports are busy, wrong session related config etc.
 * @event FAILED_TO_ADD_STREAM_TO_PROXY
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_TO_ADD_STREAM_TO_PROXY', 'Failed to add stream to proxy');

/**
 * Stopped shapshot distributor.
 * @event DISTRIBUTOR_STOPPED
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'DISTRIBUTOR_STOPPED', 'Distributor stopped');

/**
 * Publish stream is not ready, try again later.
 * @event PUBLISH_STREAM_IS_NOT_READY
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'PUBLISH_STREAM_IS_NOT_READY', 'Publish stream is not ready');

/**
 * Stream with this name is not found, check the correct of the name.
 * @event STREAM_NOT_FOUND
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'STREAM_NOT_FOUND', 'Stream not found');

/**
 * Server already has a publish stream with the same name, try using different one.
 * @event STREAM_NAME_ALREADY_IN_USE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'STREAM_NAME_ALREADY_IN_USE', 'Stream name is already in use');

/**
 * Error indicates that stream object received by server has empty mediaSessionId field.
 * @event MEDIASESSION_ID_NULL
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'MEDIASESSION_ID_NULL', 'MediaSessionId is null');

/**
 * Published or subscribed sessions used this MediaSessionId.
 * @event MEDIASESSION_ID_ALREADY_IN_USE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'MEDIASESSION_ID_ALREADY_IN_USE', 'MediaSessionId is already in use');

/**
 * Session is not initialized or terminated on play ordinary stream.
 * @event SESSION_NOT_READY
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'SESSION_NOT_READY', 'Session not ready');

/**
 * Actual session does not exist.
 * @event SESSION_DOES_NOT_EXIST
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'SESSION_DOES_NOT_EXIST', 'Session does not exist');

/**
 * RTSP has wrong format on play stream, check correct of the RTSP url.
 * @event RTSP_HAS_WRONG_FORMAT
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'RTSP_HAS_WRONG_FORMAT', 'Rtsp has wrong format');

/**
 * Failed to play vod stream, this format is not supported.
 * @event FILE_HAS_WRONG_FORMAT
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FILE_HAS_WRONG_FORMAT', 'File has wrong format');

/**
 * Failed to connect to rtsp stream.
 * @event FAILED_TO_CONNECT_TO_RTSP_STREAM
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_TO_CONNECT_TO_RTSP_STREAM', 'Failed to connect to rtsp stream');

/**
 * Rtsp stream is not found, agent received "404-Not Found".
 * @event RTSP_STREAM_NOT_FOUND
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'RTSP_STREAM_NOT_FOUND', 'Rtsp stream not found');

/**
 * On shutdown RTSP agent.
 * @event RTSPAGENT_SHUTDOWN
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'RTSPAGENT_SHUTDOWN', 'RtspAgent shutdown');

/**
 * Stream failed
 * @event STREAM_FAILED
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'STREAM_FAILED', 'Stream failed');

/**
 * No common codecs on setup track, did not found corresponding trackId->mediaPort.
 * @event NO_COMMON_CODECS
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'NO_COMMON_CODECS', 'No common codecs');

/**
 * Bad referenced rtsp link, check for correct, example: rtsp://user:b@d_password@127.0.0.1/stream.
 * @event BAD_URI
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'BAD_URI', 'Bad URI');

/**
 * General VOD error, indicates that Exception occurred while reading/processing media file.
 * @event GOT_EXCEPTION_WHILE_STREAMING_FILE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'GOT_EXCEPTION_WHILE_STREAMING_FILE', 'Got exception while streaming file');

/**
 * Requested stream shutdown.
 * @event REQUESTED_STREAM_SHUTDOWN
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'REQUESTED_STREAM_SHUTDOWN', 'Requested stream shutdown');

/**
 * Failed to create movie, file can not be read.
 * @event FAILED_TO_READ_FILE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_TO_READ_FILE', 'Failed to read file');

/**
 * File does not exist, check filename.
 * @event FILE_NOT_FOUND
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FILE_NOT_FOUND', 'File not found');

/**
 * Server failed to establish websocket connection with origin server.
 * @event FAILED_TO_CONNECT_TO_ORIGIN_STREAM
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_TO_CONNECT_TO_ORIGIN_STREAM', 'Failed to connect to origin stream');

/**
 * CDN stream not found.
 * @event CDN_STREAM_NOT_FOUND
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'CDN_STREAM_NOT_FOUND', 'CDN stream not found');

/**
 * Indicates that provided URL protocol in stream name is invalid.
 * Valid: vod://file.mp4
 * Invalid: dov://file.mp4
 * @event FAILED_TO_GET_AGENT_STORAGE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'FAILED_TO_GET_AGENT_STORAGE', 'Failed to get agent storage');

/**
 * Shutdown agent servicing origin stream.
 * @event AGENT_SERVICING_ORIGIN_STREAM_IS_SHUTTING_DOWN
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'AGENT_SERVICING_ORIGIN_STREAM_IS_SHUTTING_DOWN', 'Agent servicing origin stream is shutting down');

/**
 * Terminated by keep-alive on walk through subscribers.
 * @event TERMINATED_BY_KEEP_ALIVE
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'TERMINATED_BY_KEEP_ALIVE', 'Terminated by keep-alive');

/**
 * Transcoding required, but disabled in settings
 * @event TRANSCODING_REQUIRED_BUT_DISABLED
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'TRANSCODING_REQUIRED_BUT_DISABLED', 'Transcoding required, but disabled');

/**
 * Access restricted by access list
 * @event RESTRICTED_ACCESS
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'RESTRICTED_ACCESS', 'Restricted access');

/**
 * No available transcoders for stream
 * @event RESTRICTED_ACCESS
 * @memberof Flashphoner.constants.STREAM_STATUS_INFO
 */
define(streamStatusInfo, 'NO_AVAILABLE_TRANSCODERS', 'No available transcoders');

/**
* @namespace Flashphoner.constants.CALL_STATUS_INFO
* @see Call
*/
var callStatusInfo = {};

/**
 * Normal call hangup.
 * @event NORMAL_CALL_CLEARING
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'NORMAL_CALL_CLEARING', 'Normal call clearing');

/**
 * Error occurred on session creation.
 * @event FAILED_BY_SESSION_CREATION
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_SESSION_CREATION', 'Failed by session creation');

/**
 * Failed by error during ICE establishment.
 * @event FAILED_BY_ICE_ERROR
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_ICE_ERROR', 'Failed by ICE error');

/**
 * RTP session failed by RTP activity timer.
 * @event FAILED_BY_RTP_ACTIVITY
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_RTP_ACTIVITY', 'Failed by RTP activity');

/**
 * FF writer was failed on RTMP.
 * @event FAILED_BY_RTMP_WRITER_ERROR
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_RTMP_WRITER_ERROR', 'Failed by RTMP writer error');

/**
 * DTLS wrong fingerprint.
 * @event FAILED_BY_DTLS_FINGERPRINT_ERROR
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_DTLS_FINGERPRINT_ERROR', 'Failed by DTLS fingerprint error');

/**
 * No common codecs in sdp
 * @event NO_COMMON_CODECS
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'NO_COMMON_CODECS', 'No common codecs');

/**
 * Client did not send DTLS packets or packets were lost/corrupted during transmission.
 * @event FAILED_BY_DTLS_ERROR
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_DTLS_ERROR', 'Failed by DTLS error');

/**
 * Error occurred during call
 * @event FAILED_BY_ERROR
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_ERROR', 'Failed by error');

/**
 * Call failed by request timeout
 * @event FAILED_BY_REQUEST_TIMEOUT
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'FAILED_BY_REQUEST_TIMEOUT', 'Failed by request timeout');

/**
 * Transcoding required, but disabled in settings
 * @event TRANSCODING_REQUIRED_BUT_DISABLED
 * @memberof Flashphoner.constants.CALL_STATUS_INFO
 */
define(callStatusInfo, 'TRANSCODING_REQUIRED_BUT_DISABLED', 'Transcoding required, but disabled');

/**
* @namespace Flashphoner.constants.ERROR_INFO
*/
var errorInfo = {};

/**
 * Error if none of MediaProviders available
 * @event NONE_OF_MEDIAPROVIDERS_AVAILABLE
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'NONE_OF_MEDIAPROVIDERS_AVAILABLE', 'None of MediaProviders available');

/**
 * Error if none of preferred MediaProviders available
 * @event NONE_OF_PREFERRED_MEDIAPROVIDERS_AVAILABLE
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'NONE_OF_PREFERRED_MEDIAPROVIDERS_AVAILABLE', 'None of preferred MediaProviders available');

/**
 * Error if API is not initialized
 * @event FLASHPHONER_API_NOT_INITIALIZED
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'FLASHPHONER_API_NOT_INITIALIZED', 'Flashphoner API is not initialized');

/**
 * Error if options.urlServer is not specified
 * @event OPTIONS_URLSERVER_MUST_BE_PROVIDED
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'OPTIONS_URLSERVER_MUST_BE_PROVIDED', 'options.urlServer must be provided');

/**
 * Error if session state is not REGISTERED
 * @event INVALID_SESSION_STATE
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'INVALID_SESSION_STATE', 'Invalid session state');

/**
 * Error if no options provided
 * @event OPTIONS_MUST_BE_PROVIDED
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'OPTIONS_MUST_BE_PROVIDED', 'options must be provided');

/**
 * Error if call status is not {@link Flashphoner.constants.CALL_STATUS.NEW}
 * @event INVALID_CALL_STATE
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'INVALID_CALL_STATE', 'Invalid call state');

/**
 * Error if event is not specified
 * @event EVENT_CANT_BE_NULL
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'EVENT_CANT_BE_NULL', 'Event can\'t be null');

/**
 * Error if callback is not a valid function
 * @event CALLBACK_NEEDS_TO_BE_A_VALID_FUNCTION
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'CALLBACK_NEEDS_TO_BE_A_VALID_FUNCTION', 'Callback needs to be a valid function');

/**
 * Error if session state is not ESTABLISHED
 * @event INVALID_SESSION_STATE
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'INVALID_SESSION_STATE', 'Invalid session state');

/**
 * Error if options.name is not specified
 * @event OPTIONS_NAME_MUST_BE_PROVIDED
 * @memberof Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'OPTIONS_NAME_MUST_BE_PROVIDED', 'options.name must be provided');

/**
 * Error if number of cams is less than 2 or already used custom stream
 * @event CAN_NOT_SWITCH_CAM
 * @memberOf Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'CAN_NOT_SWITCH_CAM', 'Number of cams is less than 2 or already used custom stream');

/**
 * Error if number of mics is less than 2 or already used custom stream
 * @event CAN_NOT_SWITCH_MIC
 * @memberOf Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'CAN_NOT_SWITCH_MIC', 'Number of mics is less than 2 or already used custom stream');

/**
 * Error if recived local error
 * @event CAN_NOT_SWITCH_MIC
 * @memberOf Flashphoner.constants.ERROR_INFO
 */
define(errorInfo, 'LOCAL_ERROR', 'Local error');

var mediaDeviceKind = {};

define(mediaDeviceKind, 'OUTPUT', 'output');

define(mediaDeviceKind, 'INPUT', 'input');

define(mediaDeviceKind, 'ALL', 'all');

var transportType = {};

define(transportType, 'UDP', 'UDP');

define(transportType, 'TCP', 'TCP');

var connectionQuality = {};
define(connectionQuality, 'PERFECT', 'PERFECT');
define(connectionQuality, 'GOOD', 'GOOD');
define(connectionQuality, 'BAD', 'BAD');
define(connectionQuality, 'UNKNOWN', 'UNKNOWN');
define(connectionQuality, 'UPDATE', 'UPDATE');

var constants = {};
define(constants, 'SESSION_STATUS', sessionStatus);
define(constants, 'STREAM_STATUS', streamStatus);
define(constants, 'CALL_STATUS', callStatus);
define(constants, 'STREAM_STATUS_INFO', streamStatusInfo);
define(constants, 'CALL_STATUS_INFO', callStatusInfo);
define(constants, 'ERROR_INFO', errorInfo);
define(constants, 'MEDIA_DEVICE_KIND', mediaDeviceKind);
define(constants, 'TRANSPORT_TYPE', transportType);
define(constants, 'CONNECTION_QUALITY', connectionQuality);

//define helper
function define(obj, name, value) {
    Object.defineProperty(obj, name, {
        value:      value,
        enumerable: true
    });
}

module.exports = constants;