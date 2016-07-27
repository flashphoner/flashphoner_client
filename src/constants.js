'use strict';

var sessionStatus = {};
define(sessionStatus, 'CONNECTED', 'CONNECTED');
define(sessionStatus, 'ESTABLISHED', 'ESTABLISHED');
define(sessionStatus, 'DISCONNECTED', 'DISCONNECTED');
define(sessionStatus, 'PENDING', 'PENDING');
define(sessionStatus, 'FAILED', 'FAILED');

var streamStatus = {};
define(streamStatus, 'NEW', 'NEW');
define(streamStatus, 'PENDING', 'PENDING');
define(streamStatus, 'PUBLISHING', 'PUBLISHING');
define(streamStatus, 'PLAYING', 'PLAYING');
define(streamStatus, 'PAUSED', 'PAUSED');
define(streamStatus, 'UNPUBLISHED', 'UNPUBLISHED');
define(streamStatus, 'STOPPED', 'STOPPED');
define(streamStatus, 'FAILED', 'FAILED');

var constants = {};
define(constants, 'SESSION_STATUS', sessionStatus);
define(constants, 'STREAM_STATUS', streamStatus);

//define helper
function define(obj, name, value) {
    Object.defineProperty(obj, name, {
        value:      value,
        enumerable: true
    });
}

module.exports = constants;