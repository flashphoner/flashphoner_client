/*
 Copyright (c) 2011 Flashphoner
 All rights reserved. This Code and the accompanying materials
 are made available under the terms of the GNU Public License v2.0
 which accompanies this distribution, and is available at
 http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

 Contributors:
 Flashphoner - initial API and implementation

 This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
 */
FlashphonerLoader = function (config) {
    this.flashphoner = null;
    this.urlServer = null;
    this.token = null;
    this.registerRequired = false;
    this.videoWidth = 320;
    this.videoHeight = 240;
    $.ajax({
        type: "GET",
        url: "flashphoner.xml",
        dataType: "xml",
        success: this.parseFlashphonerXml,
        context: this
    });
};

FlashphonerLoader.prototype = {

    parseFlashphonerXml: function (xml) {
        var me = this;
        var urlServer = $(xml).find("rtmp_server");
        if (urlServer.length){
            this.urlServer = urlServer.text();
        }
        var token = $(xml).find("token");
        if (token.length){
             this.token = token.text();
        }
        var registerRequired = $(xml).find("register_required");
        if (registerRequired.length){
            this.registerRequired = registerRequired.text();
        }
        var videoWidth = $(xml).find("video_width");
        if (videoWidth.length){
            this.videoWidth = videoWidth.text();
        }
        var videoHeight = $(xml).find("video_height");
        if (videoHeight.length){
            this.videoHeight = videoHeight.text();
        }

        if (this.urlServer.indexOf("ws://") == 0) {
            me.flashphoner = new WebSocketManager(this.urlServer);
            notifyFlashReady();
        } else if (this.urlServer.indexOf("rtmfp://") == 0 || this.urlServer.indexOf("rtmp://") == 0) {
            var params = {};
            params.menu = "true";
            params.swliveconnect = "true";
            params.allowfullscreen = "true";
            params.allowscriptaccess = "always";
            params.wmode = "transparent";
            var attributes = {};
            var flashvars = {};
            flashvars.config = "flashphoner.xml";

            if (this.hasFlash()) {
                swfobject.embedSWF("flashphoner_js_api.swf", "jsSWFDiv", "100%", "100%", "11.2.202", "expressInstall.swf", flashvars, params, attributes, function (e) {
                    me.flashphoner = e.ref;
                });
            }

        }

    },

    hasFlash: function () {
        return swfobject.hasFlashPlayerVersion("11.2");
    },

    getFlashphoner: function () {
        return this.flashphoner;
    },

    getToken: function(){
        return this.token;
    }
};



