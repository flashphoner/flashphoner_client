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

}

LoadToolListener.prototype = {
    onCall: function () {
        trace("LoadToolListener: onCall");
        flashphoner.setLTState("active");
    },

    onAnswer: function () {
        trace("LoadToolListener: onAnswer");
        flashphoner.setLTState("active");
    },

    onError: function () {
        trace("LoadToolListener: onError");
        flashphoner.setLTState("idle");
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
    }
}
