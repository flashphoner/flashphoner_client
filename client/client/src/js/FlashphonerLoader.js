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
    this.flashphoner_UI = null;
    this.flashphonerListener = new DefaultListener();
    this.useWebRTC = false;
    this.urlServer = null;
    this.wcsIP = null;
    this.wsPort = "8080";
    this.flashPort = "1935";
    this.appName = "phone_app";
    this.loadBalancerUrl = null;
    this.jsonpSuccess = false;
    this.token = null;
    this.registerRequired = true;
    this.useDTLS = true;
    this.videoWidth = 320;
    this.videoHeight = 240;
    this.pushLogEnabled = false;
    this.ringSound = "sounds/CALL_OUT.ogg";
    this.busySound = "sounds/BUSY.ogg";
    this.registerSound = "sounds/REGISTER.ogg";
    this.finishSound = "sounds/HANGUP.ogg";
    this.messageSound = "sounds/MESSAGE.ogg";
    this.xcapUrl = null;
    this.msrpCallee = null;
    this.subscribeEvent = null;
    this.contactParams = null;
    this.imdnEnabled = false;
    this.msgContentType = "text/plain";
    this.stripCodecs = new Array();
    this.stunServer = "";
    this.disableLocalRing = false;
    this.modeLT = false;
    this.hangupLT = 0;
    this.answerLT = 0;
    this.callLT = 0;
    this.disableUnknownMsgFiltering = false;
    this.suppressRingOnActiveAudioStream = false;

    $.ajax({
        type: "GET",
        url: "flashphoner.xml",
        dataType: "xml",
        success: this.parseFlashphonerXml,
        context: this
    });
};

FlashphonerLoader.prototype = {

    getText: function (el){
        return el.textContent || el.text || "";
    },

    parseFlashphonerXml: function (xml) {
        var me = this;
        var wcsIP = $(xml).find("wcs_server");
        if (wcsIP.length > 0) {
            this.wcsIP = this.getText(wcsIP[0]);
        } else {
            openConnectingView("Can not find 'wcs_server' in flashphoner.xml", 0);
            return;
        }
        var wsPort = $(xml).find("ws_port");
        if (wsPort.length > 0) {
            this.wsPort = this.getText(wsPort[0]);
        }
        var wssPort = $(xml).find("wss_port");
        if (wssPort.length > 0) {
            this.wssPort = this.getText(wssPort[0]);
        }
        var useWss= $(xml).find("use_wss");
        if (useWss.length > 0) {
            this.useWss = "true" == this.getText(useWss[0]);
        }

        var flashPort = $(xml).find("flash_port");
        if (flashPort.length > 0) {
            this.flashPort = this.getText(flashPort[0]);
        }
        var appName = $(xml).find("application");
        if (appName.length > 0) {
            this.appName = this.getText(appName[0]);
        }
        var loadBalancerUrl = $(xml).find("load_balancer_url");
        if (loadBalancerUrl.length > 0) {
            this.loadBalancerUrl = this.getText(loadBalancerUrl[0]);
        }
        var token = $(xml).find("token");
        if (token.length > 0) {
            this.token = this.getText(token[0]);
        }
        var registerRequired = $(xml).find("register_required");
        if (registerRequired.length > 0) {
            this.registerRequired = (this.getText(registerRequired[0]) === "true");
        }

        var useDTLS = $(xml).find("use_dtls");
        if (useDTLS.length > 0) {
            this.useDTLS = (this.getText(useDTLS[0]) === "true");
        }

        var videoWidth = $(xml).find("video_width");
        if (videoWidth.length > 0) {
            this.videoWidth = this.getText(videoWidth[0]);
        }
        var videoHeight = $(xml).find("video_height");
        if (videoHeight.length > 0) {
            this.videoHeight = this.getText(videoHeight[0]);
        }

        var pushLogEnabled = $(xml).find("push_log");
        if (pushLogEnabled.length) {
            this.pushLogEnabled = pushLogEnabled.text();
        }

        //Sounds for WebRTC implementation
        var ringSound = $(xml).find("ring_sound");
        if (ringSound.length > 0) {
            if (this.getText(ringSound[0]).length) {
                this.ringSound = this.getText(ringSound[0]);
            }
        }
        var busySound = $(xml).find("busy_sound");
        if (busySound.length > 0) {
            if (this.getText(busySound[0]).length) {
                this.busySound = this.getText(busySound[0]);
            }
        }
        var registerSound = $(xml).find("register_sound");
        if (registerSound.length > 0) {
            if (this.getText(registerSound[0]).length) {
                this.registerSound = this.getText(registerSound[0]);
            }
        }
        var messageSound = $(xml).find("message_sound");
        if (messageSound.length > 0) {
            if (this.getText(messageSound[0]).length) {
                this.messageSound = this.getText(messageSound[0]);
            }
        }
        var finishSound = $(xml).find("finish_sound");
        if (finishSound.length > 0) {
            if (this.getText(finishSound[0]).length) {
                this.finishSound = this.getText(finishSound[0]);
            }
        }

        var xcapUrl = $(xml).find("xcap_url");
        if (xcapUrl.length > 0) {
            if (this.getText(xcapUrl[0]).length) {
                this.xcapUrl = this.getText(xcapUrl[0]);
            }
        }

        var msrpCallee = $(xml).find("msrp_callee");
        if (msrpCallee.length > 0) {
            if (this.getText(msrpCallee[0]).length) {
                this.msrpCallee = this.getText(msrpCallee[0]);
            }
        }

        var subscribeEvent = $(xml).find("subscribe_event");
        if (subscribeEvent.length > 0) {
            if (this.getText(subscribeEvent[0]).length) {
                this.subscribeEvent = this.getText(subscribeEvent[0]);
            }
        }

        var contactParams = $(xml).find("contact_params");
        if (contactParams.length > 0) {
            if (this.getText(contactParams[0]).length) {
                this.contactParams = this.getText(contactParams[0]);
            }
        }

        var imdnEnabled = $(xml).find("imdn_enabled");
        if (imdnEnabled.length > 0) {
            if (this.getText(imdnEnabled[0]).length) {
                this.imdnEnabled = Boolean(this.getText(imdnEnabled[0]));
            }
        }

        var disableLocalRing = $(xml).find("disable_local_ring");
        if (disableLocalRing.length > 0) {
            if (this.getText(disableLocalRing[0]).length) {
                this.disableLocalRing = Boolean(this.getText(disableLocalRing[0]));
            }
        }
        console.log("disableLocalRing: "+this.disableLocalRing);

        //Message content type by default "text/plain", can be "message/cpim"
        var msgContentType = $(xml).find("msg_content_type");
        if (msgContentType.length > 0) {
            this.msgContentType = msgContentType.text();
            console.log("Message content type: " + this.msgContentType);
        }

        var stripCodecs = $(xml).find("strip_codecs");
        if (stripCodecs.length > 0) {
            var tempCodecs = this.getText(stripCodecs[0]).split(",");
            for (i = 0; i < tempCodecs.length; i++) {
                if (tempCodecs[i].length) this.stripCodecs[i] = tempCodecs[i];
                console.log("Codec " + tempCodecs[i] + " will be removed from SDP!");
            }
        }

        //stun server address
        var stunServer = $(xml).find("stun_server");
        if (stunServer.length > 0) {
            this.stunServer = stunServer.text();
            console.log("Stun server: " + this.stunServer);
        }

        //variable participating in api load, can bee null, webrtc, flash
        var streamingType = $(xml).find("streaming");
        if (streamingType.length > 0) {
            if (streamingType.text() == "webrtc") {
                console.log("Force WebRTC usage!");
                isWebRTCAvailable = true;
            } else if (streamingType.text() == "flash") {
                console.log("Force Flash usage!");
                isWebRTCAvailable = false;
            } else {
                console.log("Bad streaming property " + streamingType.text() +
                    ", can be webrtc or flash. Using default behaviour!")
            }
        }

        //Load Tool mode on/off
        var modeLT = $(xml).find("modeLT");
        if (modeLT.length > 0) {
            if (this.getText(modeLT[0]).length) {
                this.modeLT = Boolean(this.getText(modeLT[0]));
            }
        }

        //call duration in seconds when Load Tool is enabled, callee will hangup after this timeout.
        // Hangup will not occur in case of 0 timeout.
        var hangupLT = $(xml).find("hangupLT");
        if (hangupLT.length > 0) {
            this.hangupLT = this.getText(hangupLT[0]);
        }

        //Answer timeout when Load Tool is enabled, if greater than 0 callee answer the call after specified amount of seconds
        var answerLT = $(xml).find("answerLT");
        if (answerLT.length > 0) {
            this.answerLT = this.getText(answerLT[0]);
        }

        //Recall timeout when Load Tool is enabled, specifies how long caller must wait after hangup to place another call.
        var callLT = $(xml).find("callLT");
        if (callLT.length > 0) {
            this.callLT = this.getText(callLT[0]);
        }

        var disableUnknownMsgFiltering = $(xml).find("disable_unknown_msg_filtering");
        if (disableUnknownMsgFiltering.length > 0) {
            this.disableUnknownMsgFiltering = (this.getText(disableUnknownMsgFiltering[0]) === "true");
        }

        var suppressRingOnActiveAudioStream = $(xml).find("suppress_ring_on_active_audio_stream");
        if (suppressRingOnActiveAudioStream.length > 0) {
            this.suppressRingOnActiveAudioStream = (this.getText(suppressRingOnActiveAudioStream[0]) === "true");
        }

        //get load balancer url if load balancing enabled
        if (me.loadBalancerUrl != null) {
            trace("FlashphonerLoader - Retrieve server url from load balancer");

            /*
             * this timeout is a workaround to catch errors from ajax request
             * Unfortunately jQuery do not support error callback in case of JSONP
             */
            setTimeout(function () {
                //check status of ajax request
                if (!me.jsonpSuccess) {
                    trace("FlashphonerLoader - Error occurred while retrieving load balancer data, please check your load balancer url " +
                        me.loadBalancerUrl);
                    me.loadAPI();
                }
            }, 10000)
            var loadBalancerData = null;
            $.ajax({
                type: "GET",
                url: me.loadBalancerUrl,
                dataType: "jsonp",
                data: loadBalancerData,
                success: function (loadBalancerData) {
                    me.wcsIP = loadBalancerData.server;
                    me.wsPort = loadBalancerData.ws;
                    me.wssPort = loadBalancerData.wss;
                    me.flashPort = loadBalancerData.flash;
                    me.jsonpSuccess = true;
                    trace("FlashphonerLoader - Connection data from load balancer: "
                        + "wcsIP " + loadBalancerData.server
                        + ", wsPort " + loadBalancerData.ws
                        + ", wssPort " + loadBalancerData.wss
                        + ", flashPort " + loadBalancerData.flash);
                    me.loadAPI();
                }
            });
        } else {
            me.loadAPI();
        }
    },

    loadAPI: function () {
        var me = this;
        if (isWebRTCAvailable) {
            me.useWebRTC = true;
            var protocol = "ws://";
            var port = this.wsPort;
            if (this.useWss){
                protocol = "wss://";
                port = this.wssPort;
            }
            me.urlServer = protocol + this.wcsIP + ":" + port;
            me.flashphoner = new WebSocketManager(getElement('localVideoPreview'), getElement('remoteVideo'));
            if (me.stripCodecs.length) me.flashphoner.setStripCodecs(me.stripCodecs);
            if (me.stunServer != "") me.flashphoner.setStunServer(me.stunServer);
            me.flashphoner_UI = new UIManagerWebRtc();
            if (me.modeLT) me.flashphonerListener = new LoadToolListener();
            notifyConfigLoaded();
        } else {
            me.useWebRTC = false;
            me.urlServer = "rtmfp://" + this.wcsIP + ":" + this.flashPort + "/" + this.appName;
            var params = {};
            params.menu = "true";
            params.swliveconnect = "true";
            params.allowfullscreen = "true";
            params.allowscriptaccess = "always";
            //in case of Safari wmode should be "window"
            if((navigator.userAgent.indexOf("Safari") > -1) && !(navigator.userAgent.indexOf("Chrome") > -1)) {
                params.wmode = "window";
                //workaround for safari browser, FPNR-403
                swfobject.switchOffAutoHideShow();
            } else if ((navigator.userAgent.indexOf("Mozilla") > -1) && (navigator.userAgent.indexOf("Firefox") > -1)) {
                params.wmode = "window";
            } else {
                params.wmode = "transparent";
            }
            var attributes = {};
            var flashvars = {};
            flashvars.config = "flashphoner.xml";

            if (this.hasFlash()) {
                swfobject.embedSWF("flashphoner_js_api.swf", "videoDiv", "100%", "100%", "11.2.202", "expressInstall.swf", flashvars, params, attributes, function (e) {
                    me.flashphoner = e.ref;
                    me.flashphoner_UI = new UIManagerFlash();
                    if (me.modeLT) me.flashphonerListener = new LoadToolListener();
                });
            } else {
                notifyFlashNotFound();
            }

        }

    },

    hasFlash: function () {
        return swfobject.hasFlashPlayerVersion("11.2");
    },

    getFlashphoner: function () {
        return this.flashphoner;
    },

    getFlashphonerUI: function () {
        return this.flashphoner_UI;
    },

    getFlashphonerListener: function () {
        return this.flashphonerListener;
    },

    getToken: function () {
        return this.token;
    }
};



