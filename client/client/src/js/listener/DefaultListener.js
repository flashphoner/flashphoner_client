/*
 Copyright (c) 2014 Flashphoner
 All rights reserved. This Code and the accompanying materials
 are made available under the terms of the GNU Public License v2.0
 which accompanies this distribution, and is available at
 http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

 Contributors:
 Flashphoner - initial API and implementation

 This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers.
 Other license versions by negatiation. Write us support@flashphoner.com with any questions.
 */
var DefaultListener = function () {

}

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
}
