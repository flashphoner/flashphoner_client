'use strict';

/**
 * @namespace Flashphoner.constants.SESSION_STATUS
 * @see Session
 */
var sessionStatus = {};

/**
 * Fires when {@link Session} ws socket opens
 * @event CONNECTED
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'CONNECTED', 'CONNECTED');

/**
 * Fires when {@link Session} receives connect ack from REST App
 * @event ESTABLISHED
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'ESTABLISHED', 'ESTABLISHED');

/**
 * Fires when {@link Session} disconnects
 * @event DISCONNECTED
 * @memberof Flashphoner.constants.SESSION_STATUS
 */
define(sessionStatus, 'DISCONNECTED', 'DISCONNECTED');

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
 * Fires when {@link Stream} starts publishing
 * @event PUBLISHING
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PUBLISHING', 'PUBLISHING');

/**
 * Fires when {@link Stream} starts playing
 * @event PLAYING
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PLAYING', 'PLAYING');

/**
 * Fires if {@link Stream} paused
 * @event PAUSED
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PAUSED', 'PAUSED');

/**
 * Fires if {@link Stream} was unpublished
 * @event UNPUBLISHING
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'UNPUBLISHED', 'UNPUBLISHED');

/**
 * Fires if {@link Stream} was stopped
 * @event STOPPED
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'STOPPED', 'STOPPED');

/**
 * Fires if {@link Stream} failed
 * @event FAILED
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'FAILED', 'FAILED');

/**
 * Fires if {@link Stream} playback problem
 * @event PLAYBACK_PROBLEM
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'PLAYBACK_PROBLEM', 'PLAYBACK_PROBLEM');

/**
 * Fires if {@link Stream} resize
 * @event RESIZE
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'RESIZE', 'RESIZE');

/**
 * Fires when {@link Stream} snapshot becomes available
 * Snapshot is base64 encoded png available through {@link Stream.getInfo}
 * @event SNAPSHOT_COMPLETE
 * @memberof Flashphoner.constants.STREAM_STATUS
 */
define(streamStatus, 'SNAPSHOT_COMPLETE', 'SNAPSHOT_COMPLETE');

/**
 * Fires on subscribe {@link Stream} if bitrate is higher than available network bandwidth
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

var constants = {};
define(constants, 'SESSION_STATUS', sessionStatus);
define(constants, 'STREAM_STATUS', streamStatus);
define(constants, 'CALL_STATUS', callStatus);

//define helper
function define(obj, name, value) {
    Object.defineProperty(obj, name, {
        value:      value,
        enumerable: true
    });
}

module.exports = constants;