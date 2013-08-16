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
    this.useWebRTC = false;
    this.urlServer = null;
    this.token = null;
    this.registerRequired = false;
    this.videoWidth = 320;
    this.videoHeight = 240;
    this.ringSound = "sounds/CALL_OUT.ogg";
    this.busySound = "sounds/BUSY.ogg";
    this.registerSound = "sounds/REGISTER.ogg";
    this.finishSound = "sounds/HANGUP.ogg";
    this.xcapUrl = null;
    this.msrpCallee = null;
    this.subscribeEvent = false;
    this.contactParams = null;
    this.multipartMessageService = null;


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
        if (urlServer.length > 0){
            this.urlServer = urlServer[0].textContent;
        } else {
            openConnectingView("Can not find 'rtmfp_server' in flashphoner.xml", 0);
            return;
        }
        var token = $(xml).find("token");
        if (token.length > 0){
             this.token = token[0].textContent;
        }
        var registerRequired = $(xml).find("register_required");
        if (registerRequired.length > 0){
            this.registerRequired = registerRequired[0].textContent;
        }
        var videoWidth = $(xml).find("video_width");
        if (videoWidth.length > 0){
            this.videoWidth = videoWidth[0].textContent;
        }
        var videoHeight = $(xml).find("video_height");
        if (videoHeight.length > 0){
            this.videoHeight = videoHeight[0].textContent;
        }
        //Sounds for WebRTC implementation
        var ringSound = $(xml).find("ring_sound");
        if (ringSound.length > 0){
            if (ringSound[0].textContent.length){
                this.ringSound = ringSound[0].textContent;
            }
        }
        var busySound = $(xml).find("busy_sound");
        if (busySound.length > 0){
            if (busySound[0].textContent.length) {
                this.busySound = busySound[0].textContent;
            }
        }
        var registerSound = $(xml).find("register_sound");
        if (registerSound.length > 0){
            if (registerSound[0].textContent.length){
                this.registerSound = registerSound[0].textContent;
            }
        }
        var finishSound = $(xml).find("finish_sound");
        if (finishSound.length > 0){
            if (finishSound[0].textContent.length){
                this.finishSound = finishSound[0].textContent;
            }
        }

        var xcapUrl = $(xml).find("xcap_url");
        if (xcapUrl.length > 0){
            if (xcapUrl[0].textContent.length){
                this.xcapUrl = xcapUrl[0].textContent;
            }
        }

        var msrpCallee = $(xml).find("msrp_callee");
        if (msrpCallee.length > 0){
            if (msrpCallee[0].textContent.length){
                this.msrpCallee = msrpCallee[0].textContent;
            }
        }

        var subscribeEvent = $(xml).find("subscribe_event");
        if (subscribeEvent.length > 0){
            if (subscribeEvent[0].textContent.length){
                this.subscribeEvent = subscribeEvent[0].textContent;
            }
        }

        var contactParams = $(xml).find("contact_params");
        if (contactParams.length > 0){
            if (contactParams[0].textContent.length){
                this.contactParams = contactParams[0].textContent;
            }
        }

        var multipartMessageService = $(xml).find("multipart_message_service");
        if (multipartMessageService.length > 0){
            if (multipartMessageService[0].textContent.length){
                this.multipartMessageService = multipartMessageService[0].textContent;
            }
        }

        if (this.urlServer.indexOf("ws://") == 0) {
            me.useWebRTC = true;
            me.flashphoner = new WebSocketManager(this.urlServer, getElement('localVideoPreview'), getElement('remoteVideo'));
            notifyFlashReady();
        } else if (this.urlServer.indexOf("rtmfp://") == 0 || this.urlServer.indexOf("rtmp://") == 0) {
            me.useWebRTC = false;
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
                swfobject.embedSWF("flashphoner_js_api.swf", "videoDiv", "100%", "100%", "11.2.202", "expressInstall.swf", flashvars, params, attributes, function (e) {
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



