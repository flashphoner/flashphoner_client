var DefaultListener = function () {

};

DefaultListener.prototype = {
    onCall: function () {
        trace("DefaultListener: onCall");
    },

    onIncomingCall: function (callId) {
        trace("DefaultListener: onIncomingCall");
    },

    onAnswer: function (callId) {
        trace("DefaultListener: onAnswer");
    },

    onError: function () {
        trace("DefaultListener: onError");
    },

    onHangup: function () {
        trace("DefaultListener: onHangup");
    },

    onRegistered: function () {
        trace("DefaultListener: onRegistered");
    },

    onRemoveCall: function () {
        trace("DefaultListener: onRemoveCall");
    }
};