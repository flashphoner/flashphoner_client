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

var Phone = function () {
    this.flashphonerListener = null;
    this.flashphoner_UI = null;
    this.currentCall = null;
    this.holdedCall = null;
    this.logs = "";
    this.intervalId = -1;
};

Phone.prototype.init = function () {
    this.flashphoner_UI = new UIManagerWebRtc();
    this.flashphonerListener = ConfigurationLoader.getInstance().getFlashphonerListener();

    Flashphoner.getInstance().addListener(WCSEvent.OnErrorEvent, this.onErrorListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.ConnectionStatusEvent, this.connectionStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnRegistrationEvent, this.onRegistrationListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnCallEvent, this.onCallListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.CallStatusEvent, this.callStatusListener, this);

    Flashphoner.getInstance().addListener(WCSEvent.OnMessageEvent, this.onMessageListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.MessageStatusEvent, this.messageStatusListener, this);

    Flashphoner.getInstance().addListener(WCSEvent.OnRecordCompleteEvent, this.onRecordCompleteListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnSubscriptionEvent, this.onSubscriptionListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnXcapStatusEvent, this.onXcapStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnBugReportEvent, this.onBugReportListener, this);
};


Phone.prototype.connect = function () {
    if ($("#outbound_proxy").val() == "") {
        $("#outbound_proxy").val($("#domain").val());
    }

    var loginObject = new Connection();
    loginObject.login = $('#username').val();
    loginObject.password = $('#password').val();
    loginObject.authenticationName = $('#authname').val();
    loginObject.domain = $('#domain').val();
    loginObject.outboundProxy = $('#outbound_proxy').val();
    loginObject.port = $('#port').val();
    loginObject.useProxy = $('#checkboxUseProxy').attr("checked") ? true : false;
    loginObject.useSelfSigned = !isMobile.any();
    loginObject.appKey = "defaultApp";

    var result = Flashphoner.getInstance().connect(loginObject);
    if (result == 0) {
        trace("Phone - connecting");
    }
};

Phone.prototype.disconnect = function () {
    trace("Phone - disconnect");
    Flashphoner.getInstance().disconnect();
};

Phone.prototype.msrpCall = function (callee) {
    trace("Phone - msrpCall " + callee);
    Flashphoner.getInstance().msrpCall({callee: callee, visibleName: 'Caller', hasVideo: false, inviteParameters: {param1: "value1", param2: "value2"}, isMsrp: true});
};

Phone.prototype.call = function (callee) {
    trace("Phone - call " + callee);
    var me = this;
    var hasAccess;
    if (me.isVideoCall()) {
        hasAccess = me.hasAccessToAudioAndVideo;
    } else {
        hasAccess = me.hasAccessToAudio;
    }
    if (!hasAccess()) {
        if (me.intervalId == -1) {
            var checkAccessFunc = function () {
                if (hasAccess()) {
                    me.flashphoner_UI.closeRequestUnmute();
                    clearInterval(me.intervalId);
                    me.intervalId = -1;
                    me.call(callee);
                }
            };
            me.intervalId = setInterval(checkAccessFunc, 500);
        }
        if (me.isVideoCall()) {
            me.flashphoner_UI.getAccessToAudioAndVideo();
        } else {
            me.flashphoner_UI.getAccessToAudio();
        }
    } else if (hasAccess()) {
        var result = Flashphoner.getInstance().call({callee: callee, visibleName: 'Caller', hasVideo: me.isVideoCall(), inviteParameters: {param1: "value1", param2: "value2"}, isMsrp: false});
        if (result == 0) {
            this.flashphonerListener.onCall();
        } else {
            trace("Callee number is wrong");
        }
    } else {
        trace("Microphone is not plugged in");
    }
};

Phone.prototype.sendMessage = function (message) {
    trace("Phone - sendMessage " + message.to + " body: " + message.body);
    Flashphoner.getInstance().sendMessage(message);
};

Phone.prototype.answer = function (callId) {
    trace("Phone - answer " + callId);
    var hasAccess;
    var me = this;
    if (me.isVideoCall()) {
        hasAccess = me.hasAccessToAudioAndVideo;
    } else {
        hasAccess = me.hasAccessToAudio;
    }
    if (!hasAccess()) {
        if (me.intervalId == -1) {
            var checkAccessFunc = function () {
                if (hasAccess()) {
                    me.flashphoner_UI.closeRequestUnmute();
                    clearInterval(me.intervalId);
                    me.intervalId = -1;
                    me.answer(callId);
                }
            };
            me.intervalId = setInterval(checkAccessFunc, 500);
        }
        if (me.isVideoCall()) {
            me.flashphoner_UI.getAccessToAudioAndVideo();
        } else {
            me.flashphoner_UI.getAccessToAudio();
        }
    } else if (hasAccess()) {
        Flashphoner.getInstance().answer(callId, me.isVideoCall());
        this.flashphonerListener.onAnswer(callId);
    } else {
        trace("Microphone is not plugged in");
    }
};

Phone.prototype.hangup = function (call) {
    trace("Phone - hangup " + call.callId);
    Flashphoner.getInstance().hangup(call);
    this.flashphonerListener.onHangup();
};

Phone.prototype.sendDTMF = function (callId, dtmf) {
    trace("Phone - sendDTMF callId: " + callId + " dtmf: " + dtmf);
    Flashphoner.getInstance().sendDTMF(callId, dtmf);
};

Phone.prototype.hold = function (callId, isHold) {
    trace("Phone - hold callId: " + callId + " isHold: " + isHold);
    Flashphoner.getInstance().hold(callId, isHold);
};

Phone.prototype.transfer = function (callId, target) {
    trace("Phone - transfer callId: " + callId + " target: " + target);
    Flashphoner.getInstance().transfer(callId, target);
};

Phone.prototype.sendXcapRequest = function () {
    Flashphoner.getInstance().sendXcapRequest();
};

Phone.prototype.subscribeReg = function () {
    var subscribeObj = {};
    subscribeObj.event = ConfigurationLoader.getInstance().subscribeEvent;
    subscribeObj.expires = 3600;
    Flashphoner.getInstance().voipSubscribe(subscribeObj);
};


Phone.prototype.hasAccessToAudioAndVideo = function () {
    return Flashphoner.getInstance().hasAccessToAudio() && Flashphoner.getInstance().hasAccessToVideo();
};

Phone.prototype.hasAccessToAudio = function () {
    return Flashphoner.getInstance().hasAccessToAudio();
};

Phone.prototype.hasAccessToVideo = function () {
    return Flashphoner.getInstance().hasAccessToVideo();
};


Phone.prototype.sendVideoChangeState = function (videoEnabled) {
    trace("Phone - sendVideoChangeState currentCall: " + me.currentCall.callId);
    Flashphoner.getInstance().setSendVideo(me.currentCall.callId, videoEnabled);
};

Phone.prototype.changeRelationMyVideo = function (relation) {
    trace("Phone - changeRelationMyVideo " + relation);
    Flashphoner.getInstance().changeRelationMyVideo(relation);
};

Phone.prototype.submitBugReport = function () {
    var bugReportText = getElement('bugReportText').value;
    trace("submitBugReport " + bugReportText);
    Flashphoner.getInstance().submitBugReport({text: bugReportText, type: "no_media"});
};

/* ------------------ LISTENERS ----------------- */

Phone.prototype.connectionStatusListener = function (event) {
    trace("Phone - Connection status " + event.connection.status);
    if (event.connection.status == ConnectionStatus.Disconnected ||
        event.connection.status == ConnectionStatus.Error) {
        this.currentCall = null;
        this.holdedCall = null;
    }
};

Phone.prototype.onRegistrationListener = function (event) {
    var connection = event.connection;
    var sipObject = event.sipObject;
    trace("Phone - onRegistrationListener " + connection.login);
    SoundControl.getInstance().playSound("REGISTER");
    this.flashphonerListener.onRegistered();

    if (ConfigurationLoader.getInstance().subscribeEvent != null && ConfigurationLoader.getInstance().subscribeEvent.length != 0) {
        this.subscribeReg();
    }

    this.sendXcapRequest();
};

Phone.prototype.onCallListener = function (event) {
    var call = event.call;
    trace("Phone - onCallListener " + call.callId + " call.incoming: " + call.incoming + " call.state: " + call.state);
    if (this.currentCall != null && !call.incoming) {
        this.holdedCall = this.currentCall;
        this.currentCall = call;
        trace("Phone - It seems like a hold: holdedCall: " + this.holdedCall.callId + " currentCall: " + this.currentCall.callId);
    } else {
        this.currentCall = call;
        if (call.incoming == true) {
            this.flashphonerListener.onIncomingCall(call.callId);
        }
        trace("Phone - It seems like a new call currentCall: " + this.currentCall.callId + " state: " + this.currentCall.state);
    }
};

Phone.prototype.callStatusListener = function (event) {
    var sipObject = event.sipObject;
    var call = event.call;
    trace("Phone - callStatusListener call id: " + call.callId + " state: " + call.state + " incoming: " + call.incoming);
    if (this.currentCall.callId == call.callId) {
        if (call.state == CallStatus.FINISH) {
            trace("Phone - ... Call is finished...");
            if (this.holdedCall != null) {
                this.currentCall = this.holdedCall;
                this.holdedCall = null;
            } else if (this.isCurrentCall(call)) {
                this.currentCall = null;
                this.flashphonerListener.onRemoveCall();
                SoundControl.getInstance().stopSound("RING");
                SoundControl.getInstance().playSound("FINISH");
            }
        } else if (call.state == CallStatus.HOLD) {
            trace('Phone - ...Call on hold...');
        } else if (call.state == CallStatus.TALK) {
            trace('Phone - ...Talking...');
            SoundControl.getInstance().stopSound("RING");
        } else if (call.state == CallStatus.RING) {
            trace('Phone - ...Ringing...');
            if (this.isRingSoundAllowed()) {
                SoundControl.getInstance().playSound("RING");
            }
        } else if (call.state == CallStatus.RING_MEDIA) {
            trace('Phone - ...Ringing...');
            SoundControl.getInstance().stopSound("RING");
        } else if (call.state == CallStatus.BUSY) {
            SoundControl.getInstance().playSound("BUSY");
        } else if (call.state == CallStatus.SESSION_PROGRESS) {
            trace('Phone - ...Call in Progress...');
            SoundControl.getInstance().stopSound("RING");
        }
    } else {
        if (this.holdedCall.callId == call.callId) {
            if (call.state == CallStatus.FINISH) {
                trace("It seems we received FINISH state on holdedCall. Just do null the holdedCall.");
                this.holdedCall = null;
            }
        }
    }
};

Phone.prototype.messageStatusListener = function (event) {
    var message = event.message;
    trace("Phone - messageStatusListener id = " +message.id + " status = " + message.status);
};

Phone.prototype.onMessageListener = function (event) {
    var message = event.message;

    if (message.contentType == "application/im-iscomposing+xml" || message.contentType == "message/fsservice+xml") {
        trace("ignore message: " + message.body);
        if (ConfigurationLoader.getInstance().disableUnknownMsgFiltering) {
            message.body = escapeXmlTags(message.body);
            SoundControl.getInstance().playSound("MESSAGE");
        }
        return;
    }

    //convert body
    var body = this.convertMessageBody(message.body, message.contentType);
    if (body) {
        message.body = body;
        SoundControl.getInstance().playSound("MESSAGE");
    } else {
        trace("Not displaying message " + message.body + ", body is null after convert");
        if (ConfigurationLoader.getInstance().disableUnknownMsgFiltering) {
            message.body = escapeXmlTags(message.body);
            SoundControl.getInstance().playSound("MESSAGE");
        }
    }

    trace("Phone - onMessageListener id = " +message.id + " body = " + message.body);
};

Phone.prototype.convertMessageBody = function (messageBody, contentType) {
    trace("Phone - convertMessageBody " + contentType);
    if (contentType == "application/fsservice+xml") {
        var xml = $.parseXML(messageBody);
        var missedCallNotification;
        var fsService = $(xml).find("fs-services").find("fs-service");
        var action = fsService.attr("action");
        if (action == "servicenoti-indicate") {
            var caw = this.parseMsn(fsService, "caw");
            if (!!caw) {
                missedCallNotification = caw;
            } else {
                missedCallNotification = parseMsn(fsService, "mcn");
            }
        } else if (action == "serviceinfo-confirm") {
            //service status confirmation
            missedCallNotification = "Service status: " + $(fsService.find("mcn").find("mcn-data")).attr("status");
        }
        if (missedCallNotification !== undefined) return missedCallNotification;

    } else if (contentType == "application/vnd.oma.push") {
        var xml = $.parseXML(messageBody);
        /**
         * application/vnd.oma.push will contain xml with app information
         * Try to handle this information or discard xml
         */
        var content;
        if ($(xml).find("ums-service")) {
            //voice mail service message
            content = $(xml).find("ni-data").attr("content");
        }
        return content;
    }

    return messageBody;

};

Phone.prototype.parseMsn = function (fsService, mcn) {
    trace("Phone - parseMcn: " + mcn);
    var caw = fsService.find(mcn);
    var ret = null;
    if (!!caw) {
        var cawData = caw.find(mcn + "-data");
        if (!!cawData) {
            var sender = $(cawData).attr("sender");
            if (!!sender) {
                trace("Phone - Missed call: " + sender);
                ret = "Missed call from " + sender;
            }
        }
    }
    return ret;
};

Phone.prototype.onRecordCompleteListener = function (recordReport) {
    trace("Phone - onRecordCompleteListener: " + recordReport.mixedFilename);
};

Phone.prototype.onSubscriptionListener = function (event) {
    var subscriptionObject = event.subscription;
    var sipObject = event.sipObject;
    trace("Phone - onSubscriptionListener event: " + subscriptionObject.event + " expires: " + subscriptionObject.expires + " status: " + subscriptionObject.status + " terminate: " + subscriptionObject.terminate);
    trace("Phone - onSubscriptionListener body: " + subscriptionObject.requestBody);
    if (subscriptionObject.event == "reg") {
        if (subscriptionObject.terminate) {
            this.disconnect();
        }
    }
};

Phone.prototype.onXcapStatusListener = function (xcapResponse) {
    trace("Phone - onXcapStatusListener " + xcapResponse);
    var xml = $.parseXML(xcapResponse);
    var history = $(xml).find("history-list").find("history");
    if (history != null && history.length != 0) {
        if (ConfigurationLoader.getInstance().msrpCallee != null && ConfigurationLoader.getInstance().msrpCallee.length != 0) {
            this.msrpCall(ConfigurationLoader.getInstance().msrpCallee);
        }
    }
};

Phone.prototype.onBugReportListener = function (event) {
    trace("Phone - onBugReportListener; filename - " + event.filename);
};

Phone.prototype.onErrorListener = function (event) {
    var code = event.code;
    var sipObject = event.sipObject;
    trace("Phone - onErrorListener " + code);

    if (code == WCSError.CONNECTION_ERROR) {
        trace("Phone - ERROR - Can`t connect to server.");
    } else if (code == WCSError.AUTHENTICATION_FAIL) {
        trace("Phone - ERROR - Register fail, please check your SIP account details.");
        window.setTimeout("disconnect();", 3000);
    } else if (code == WCSError.USER_NOT_AVAILABLE) {
        trace("Phone - ERROR - User not available.");
    } else if (code == WCSError.LICENSE_RESTRICTION) {
        trace("Phone - ERROR - You trying to connect too many users, or license is expired");
    } else if (code == WCSError.LICENSE_NOT_FOUND) {
        trace("Phone - ERROR - Please get a valid license or contact Flashphoner support");
    } else if (code == WCSError.INTERNAL_SIP_ERROR) {
        trace("Phone - ERROR - Unknown error. Please contact support.");
    } else if (code == WCSError.REGISTER_EXPIRE) {
        trace("Phone - ERROR - No response from VOIP server during 15 seconds.");
    } else if (code == WCSError.SIP_PORTS_BUSY) {
        trace("Phone - ERROR - SIP ports are busy. Please open SIP ports range (30000-31000 by default).");
        window.setTimeout("disconnect();", 3000);
    } else if (code == WCSError.MEDIA_PORTS_BUSY) {
        trace("Phone - ERROR - Media ports are busy. Please open media ports range (31001-32000 by default).");
    } else if (code == WCSError.WRONG_SIPPROVIDER_ADDRESS) {
        trace("Phone - ERROR - Wrong domain.");
        window.setTimeout("disconnect();", 3000);
    } else if (code == WCSError.CALLEE_NAME_IS_NULL) {
        trace("Phone - ERROR - Callee name is empty.");
    } else if (code == WCSError.WRONG_FLASHPHONER_XML) {
        trace("Phone - ERROR - Flashphoner.xml has errors. Please check it.");
    } else if (code == WCSError.PAYMENT_REQUIRED) {
        trace("Phone - ERROR - Payment required, please check your balance.");
    }

    this.flashphonerListener.onError();
};

/* ------------- Additional interface functions --------- */
Phone.prototype.isCurrentCall = function (call) {
    return this.currentCall != null && this.currentCall.callId == call.callId;
};

Phone.prototype.isVideoCall = function () {
    return $('#checkboxVideoCall').attr("checked") ? true : false;
};

Phone.prototype.isRingSoundAllowed = function () {
    try {
        if (ConfigurationLoader.getInstance().suppressRingOnActiveAudioStream && Flashphoner.getInstance().hasActiveAudioStream()) {
            trace("Phone - isRingSoundAllowed false");
            return false;
        }
    } catch (error) {
    }
    trace("Phone - isRingSoundAllowed true");
    return true;
};
