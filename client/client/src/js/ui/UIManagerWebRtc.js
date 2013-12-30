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
        trace("UIManagerWebRTC - requestUnmute");
        openInfoView("Please allow access to media devices", 0, 60);
        flashphoner.getAccessToAudio();
    },

    getAccessToAudioAndVideo: function() {
        trace("UIManagerWebRTC - getAccessToAudio");
        openInfoView("Please allow access to audio and video devices", 0, 60);
        flashphoner.getAccessToAudioAndVideo();
    },

    getAccessToAudio: function() {
        trace("UIManagerWebRTC - getAccessToAudio");
        openInfoView("Please allow access to audio device", 0, 60);
        flashphoner.getAccessToAudio();
    },

    openVideoView: function() {
        trace("UIManagerWebRTC - openVideoView");
        if (!flashphoner.hasAccessToVideo()){
            openInfoView("Please allow access to video device", 0, 60);
            flashphoner.getAccessToAudioAndVideo();
            if (intervalId == -1) {
                intervalId = setInterval('if (flashphoner.hasAccessToVideo()){flashphoner_UI.closeRequestUnmute(); clearInterval(intervalId); intervalId = -1; }', 500);
            }
        }

        $('#video_requestUnmuteDiv').removeClass().addClass('videoDiv');
        $('#closeButton_video_requestUnmuteDiv').css('visibility', 'visible');

        $('#requestUnmuteText').hide();
        $('#video_requestUnmuteDiv .bar').html('&nbsp;&nbsp;Video');

        if (proportion != 0) {
            var newHeight = $('.videoDiv').width() * proportion + 40;
            $('.videoDiv').height(newHeight); //we resize video window for new proportion
        }
        $('#video_requestUnmuteDiv').resize();
    },

    closeRequestUnmute: function() {
        closeInfoView();
    },

    closeRequestUnmuteC2C: function() {
        this.closeRequestUnmute();
    }
};