/**
 Copyright (c) 2013 Flashphoner
 All rights reserved. This Code and the accompanying materials
 are made available under the terms of the GNU Public License v2.0
 which accompanies this distribution, and is available at
 http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

 Contributors:
 Flashphoner - initial API and implementation

 This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
 */
var UIManagerWebRtc = function () {

}

UIManagerWebRtc.prototype = {
    requestUnmuteC2C: function() {
        trace("requestUnmute");
        openInfoView("Please allow access to media devices", 0, 60);
        flashphoner.getAccessToAudio();
    },

    getAccessToAudio: function() {
        trace("getAccessToAudio");
        openInfoView("Please allow access to audio devices", 0, 60);
        flashphoner.getAccessToAudio();
    },

    getAccessToVideo: function() {
        trace("getAccessToVideo");
        openInfoView("Please allow access to video device", 0, 60);
        flashphoner.getAccessToVideo();
    },

    closeRequestUnmute: function() {
    },

    closeRequestUnmuteC2C: function() {
        this.closeRequestUnmute();
    }
}