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
    this.useWebRTC = false;
    this.urlServer = null;
    this.wcsIP = null;
    this.wsPort = "8080";
    this.flashPort = "1935";
    this.appName = "phone_app";
    this.loadBalancerUrl = null;
    this.jsonpSuccess = false;
    this.token = null;
    this.registerRequired = false;
    this.videoWidth = 320;
    this.videoHeight = 240;
    this.pushLogEnabled = false;
    this.ringSound = "sounds/CALL_OUT.ogg";
    this.busySound = "sounds/BUSY.ogg";
    this.registerSound = "sounds/REGISTER.ogg";
    this.finishSound = "sounds/HANGUP.ogg";
    this.xcapUrl = null;
    this.msrpCallee = null;
    this.subscribeEvent = "reg";
    this.contactParams = null;
    this.imdnEnabled = false;


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
        var wcsIP = $(xml).find("wcs_server");
        if (wcsIP.length > 0) {
            this.wcsIP = wcsIP[0].textContent;
        } else {
            openConnectingView("Can not find 'wcs_server' in flashphoner.xml", 0);
            return;
        }
        var wsPort = $(xml).find("ws_port");
        if (wsPort.length > 0) {
            this.wsPort = wsPort[0].textContent;
        }
        var flashPort = $(xml).find("flash_port");
        if (flashPort.length > 0) {
            this.flashPort = flashPort[0].textContent;
        }
        var appName = $(xml).find("application");
        if (appName.length > 0) {
            this.appName = appName[0].textContent;
        }
        var loadBalancerUrl = $(xml).find("load_balancer_url");
        if (loadBalancerUrl.length > 0) {
            this.loadBalancerUrl = loadBalancerUrl[0].textContent;
        }
        var token = $(xml).find("token");
        if (token.length > 0) {
            this.token = token[0].textContent;
        }
        var registerRequired = $(xml).find("register_required");
        if (registerRequired.length > 0) {
            this.registerRequired = registerRequired[0].textContent;
        }
        var videoWidth = $(xml).find("video_width");
        if (videoWidth.length > 0) {
            this.videoWidth = videoWidth[0].textContent;
        }
        var videoHeight = $(xml).find("video_height");
        if (videoHeight.length > 0) {
            this.videoHeight = videoHeight[0].textContent;
        }

        var pushLogEnabled = $(xml).find("push_log");
        if (pushLogEnabled.length) {
            this.pushLogEnabled = pushLogEnabled.text();
        }

        //Sounds for WebRTC implementation
        var ringSound = $(xml).find("ring_sound");
        if (ringSound.length > 0) {
            if (ringSound[0].textContent.length) {
                this.ringSound = ringSound[0].textContent;
            }
        }
        var busySound = $(xml).find("busy_sound");
        if (busySound.length > 0) {
            if (busySound[0].textContent.length) {
                this.busySound = busySound[0].textContent;
            }
        }
        var registerSound = $(xml).find("register_sound");
        if (registerSound.length > 0) {
            if (registerSound[0].textContent.length) {
                this.registerSound = registerSound[0].textContent;
            }
        }
        var finishSound = $(xml).find("finish_sound");
        if (finishSound.length > 0) {
            if (finishSound[0].textContent.length) {
                this.finishSound = finishSound[0].textContent;
            }
        }

        var xcapUrl = $(xml).find("xcap_url");
        if (xcapUrl.length > 0) {
            if (xcapUrl[0].textContent.length) {
                this.xcapUrl = xcapUrl[0].textContent;
            }
        }

        var msrpCallee = $(xml).find("msrp_callee");
        if (msrpCallee.length > 0) {
            if (msrpCallee[0].textContent.length) {
                this.msrpCallee = msrpCallee[0].textContent;
            }
        }

        var subscribeEvent = $(xml).find("subscribe_event");
        if (subscribeEvent.length > 0) {
            if (subscribeEvent[0].textContent.length) {
                this.subscribeEvent = subscribeEvent[0].textContent;
            }
        }

        var contactParams = $(xml).find("contact_params");
        if (contactParams.length > 0) {
            if (contactParams[0].textContent.length) {
                this.contactParams = contactParams[0].textContent;
            }
        }

        var imdnEnabled = $(xml).find("imdn_enabled");
        if (imdnEnabled.length > 0) {
            if (imdnEnabled[0].textContent.length) {
                this.imdnEnabled = Boolean(imdnEnabled[0].textContent);
            }
        }

        //get load balancer url if load balancing enabled
        if (me.loadBalancerUrl != null) {
            trace("Retrieve server url from load balancer");

            /*
             * this timeout is a workaround to catch errors from ajax request
             * Unfortunately jQuery do not support error callback in case of JSONP
             */
            setTimeout(function () {
                //check status of ajax request
                if (!this.jsonpSuccess) {
                    trace("Error occurred while retrieving load balancer data, please check your load balancer url " +
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
                    this.wcsIP = loadBalancerData.server;
                    this.wsPort = loadBalancerData.ws;
                    this.flashPort = loadBalancerData.flash;
                    this.jsonpSuccess = true;
                    trace("Connection data from load balancer: "
                        + "wcsIP " + loadBalancerData.server
                        + ", wsPort " + loadBalancerData.ws
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
            me.urlServer = "ws://" + this.wcsIP + ":" + this.wsPort;
            me.flashphoner = new WebSocketManager(getElement('localVideoPreview'), getElement('remoteVideo'));
            me.flashphoner_UI = new UIManagerWebRtc();
            notifyFlashReady();
        } else {
            me.useWebRTC = false;
            me.urlServer = "rtmfp://" + this.wcsIP + ":" + this.flashPort + "/" + this.appName;
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
                    me.flashphoner_UI = new UIManagerFlash();
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

    getFlashphonerUI: function () {
        return this.flashphoner_UI;
    },

    getToken: function () {
        return this.token;
    }
};



