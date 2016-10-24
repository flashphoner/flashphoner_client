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
var LoadToolListener = function () {

};

LoadToolListener.prototype = {
    onCall: function () {
        trace("LoadToolListener: onCall");
        flashphoner.setLTState("active");
    },

    onIncomingCall: function (callId) {
        trace("LoadToolListener: onIncomingCall");
        if (flashphonerLoader.answerLT != 0) {
            setTimeout(function(){answer(callId);}, flashphonerLoader.answerLT*1000);
        }
    },

    onAnswer: function (callId) {
        trace("LoadToolListener: onAnswer");
        closeIncomingView();
        flashphoner.setLTState("active");
        if (flashphonerLoader.hangupLT != 0) {
            setTimeout(function(){hangup(callId);}, flashphonerLoader.hangupLT*1000);
        }
    },

    onError: function () {
        trace("LoadToolListener: onError");
        flashphoner.setLTState("idle");
        //if this is error at caller side, renew call attempt
        if (flashphonerLoader.getToken() == "caller" && flashphonerLoader.callLT != 0) {
            setTimeout(function(){callByToken(callToken);}, flashphonerLoader.callLT*1000);
        }
    },

    onHangup: function () {
        trace("LoadToolListener: onHangup");
        flashphoner.setLTState("idle");
    },

    onRegistered: function () {
        trace("LoadToolListener: onRegistered");
        flashphoner.setLTState("idle");
    },

    onRemoveCall: function () {
        trace("LoadToolListener: onRemoveCall");
        flashphoner.setLTState("idle");
        if (flashphonerLoader.getToken() == "caller" && flashphonerLoader.callLT != 0) {
            setTimeout(function(){callByToken(callToken);}, flashphonerLoader.callLT*1000);
        }
    }
}
