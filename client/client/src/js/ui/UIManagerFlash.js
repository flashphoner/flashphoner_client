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
var UIManagerFlash = function () {

}

UIManagerFlash.prototype = {
    requestUnmute: function() {
        trace("requestUnmute");

        $('#video_requestUnmuteDiv').removeClass().addClass('securityDiv');
        $('#closeButton_video_requestUnmuteDiv').css('visibility', 'hidden');
        $('#sendVideo').css('visibility', 'hidden');
        $('#requestUnmuteText').show();

        $('#video').width(214);
        $('#video').height(138);
        getElement('video').style.top = "35px";

        this.viewAccessMessage();

    },

    closeRequestUnmute: function() {
        trace("closeRequestUnmute");
        $('#video_requestUnmuteDiv').removeClass().addClass('closed');
        getElement('video').style.top = "20px";
    },

    viewAccessMessage: function() {
        trace("viewAccessMessage");
        flashphoner.viewAccessMessage();

    }

}