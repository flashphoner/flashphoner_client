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
    this.currentCall = null;
    this.holdedCall = null;
    this.logs = "";
    this.intervalId = -1;
};

Phone.prototype.init = function () {
    this.flashphonerListener = new DefaultListener();

    Flashphoner.getInstance().addListener(WCSEvent.ErrorStatusEvent, this.errorStatusEvent, this);
    Flashphoner.getInstance().addListener(WCSEvent.ConnectionStatusEvent, this.connectionStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.RegistrationStatusEvent, this.registrationStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnCallEvent, this.onCallListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.CallStatusEvent, this.callStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnTransferEvent, this.onTransferEventListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.TransferStatusEvent, this.onTransferStatusListener, this);

    Flashphoner.getInstance().addListener(WCSEvent.OnMessageEvent, this.onMessageListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.MessageStatusEvent, this.messageStatusListener, this);

    Flashphoner.getInstance().addListener(WCSEvent.RecordingStatusEvent, this.recordingStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.SubscriptionStatusEvent, this.subscriptionStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.XcapStatusEvent, this.xcapStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.BugReportStatusEvent, this.bugReportStatusListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.OnDataEvent, this.onDataEventListener, this);
    Flashphoner.getInstance().addListener(WCSEvent.DataStatusEvent, this.dataStatusEventListener, this);
};


Phone.prototype.connect = function () {
    if ($("#outbound_proxy").val() == "") {
        $("#outbound_proxy").val($("#domain").val());
    }

    var connection = new Connection();
    connection.sipLogin = $('#username').val();
    connection.sipPassword = $('#password').val();
    connection.sipAuthenticationName = $('#authname').val();
    connection.sipDomain = $('#domain').val();
    connection.sipOutboundProxy = $('#outbound_proxy').val();
    connection.sipPort = $('#port').val();
    connection.useSelfSigned = !isMobile.any();
    connection.appKey = "defaultApp";

    var result = Flashphoner.getInstance().connect(connection);
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

Phone.prototype.call = function (callee, hasVideo, mediaProvider) {
    trace("Phone - call " + callee);
    var me = this;
    if (!me.hasAccess(mediaProvider, hasVideo)) {
        if (me.intervalId == -1) {
            var checkAccessFunc = function () {
                if (me.hasAccess(mediaProvider, hasVideo)) {
                    clearInterval(me.intervalId);
                    me.intervalId = -1;
                    me.call(callee, hasVideo, mediaProvider);
                }
            };
            me.intervalId = setInterval(checkAccessFunc, 500);
        }
        me.getAccess(mediaProvider, hasVideo);
    } else if (me.hasAccess(mediaProvider, hasVideo)) {
        var call = new Call();
        call.callee = callee;
        call.visibleName = "Caller";
        call.hasVideo = hasVideo;
        call.inviteParameters = {param1: "value1", param2: "value2"};
        call.mediaProvider = mediaProvider;
        this.currentCall = Flashphoner.getInstance().call(call);
        this.flashphonerListener.onCall();
    } else {
        trace("Microphone is not plugged in");
    }
};

Phone.prototype.sendMessage = function (message) {
    trace("Phone - sendMessage " + message.to + " body: " + message.body);
    Flashphoner.getInstance().sendMessage(message);
};

Phone.prototype.hasAccess = function (mediaProvider, hasVideo) {
    if (hasVideo) {
        return Flashphoner.getInstance().hasAccessToAudioAndVideo(mediaProvider);
    } else {
        return Flashphoner.getInstance().hasAccessToAudio(mediaProvider);
    }
};

Phone.prototype.getAccess = function (mediaProvider, hasVideo) {
    if (hasVideo) {
        return Flashphoner.getInstance().getAccessToAudioAndVideo(mediaProvider);
    } else {
        return Flashphoner.getInstance().getAccessToAudio(mediaProvider);
    }
};


Phone.prototype.answer = function (call, hasVideo) {
    trace("Phone - answer " + call.callId);
    var me = this;
    if (!me.hasAccess(call.mediaProvider, hasVideo)) {
        if (me.intervalId == -1) {
            var checkAccessFunc = function () {
                if (me.hasAccess(call.mediaProvider, hasVideo)) {
                    clearInterval(me.intervalId);
                    me.intervalId = -1;
                    me.answer(call, hasVideo);
                }
            };
            me.intervalId = setInterval(checkAccessFunc, 500);
        }
        me.getAccess(call.mediaProvider,hasVideo);
    } else if (me.hasAccess(call.mediaProvider, hasVideo)) {
        call.hasVideo = hasVideo;
        Flashphoner.getInstance().answer(call);
        this.flashphonerListener.onAnswer(call.callId);
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
    Flashphoner.getInstance().sendDTMF({callId: callId, dtmf: dtmf});
};

Phone.prototype.hold = function (call) {
    trace("Phone - hold callId: " + call.callId);
    Flashphoner.getInstance().hold(call);
};

Phone.prototype.unhold = function (call) {
    trace("Phone - hold callId: " + call.callId);
    Flashphoner.getInstance().unhold(call);
};

Phone.prototype.transfer = function (callId, target) {
    trace("Phone - transfer callId: " + callId + " target: " + target);
    Flashphoner.getInstance().transfer({callId: callId, target: target});
};

Phone.prototype.sendXcapRequest = function () {
    var url = ConfigurationLoader.getInstance().xcapUrl;
    if (url) {
        Flashphoner.getInstance().sendXcapRequest({url: url});
    }
};

Phone.prototype.subscribe = function () {
    var subscribeObj = {};
    subscribeObj.event = ConfigurationLoader.getInstance().subscribeEvent;
    subscribeObj.expires = 3600;
    Flashphoner.getInstance().subscribe(subscribeObj);
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

Phone.prototype.sendData = function (data) {
    trace("sendData " + data);
    Flashphoner.getInstance().sendData(data);
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

Phone.prototype.registrationStatusListener = function (event) {
    var status = event.status;
    var sipObject = event.sipMessageRaw;
    trace("Phone - registrationStatusListener " + status);
    if (status == WCSError.AUTHENTICATION_FAIL) {
        trace("Phone - ERROR - Register fail, please check your SIP account details.");
        window.setTimeout(this.disconnect(), 3000);
    } else {
        SoundControl.getInstance().playSound("REGISTER");
        this.flashphonerListener.onRegistered();

        if (ConfigurationLoader.getInstance().subscribeEvent != null && ConfigurationLoader.getInstance().subscribeEvent.length != 0) {
            this.subscribe();
        }

        this.sendXcapRequest();
    }
};

Phone.prototype.onCallListener = function (event) {
    var call = event;
    trace("Phone - onCallListener " + call.callId + " call.mediaProvider: " + call.mediaProvider + " call.status: " + call.status);
    if (this.currentCall != null && !call.incoming) {
        this.holdedCall = this.currentCall;
        this.currentCall = call;
        trace("Phone - It seems like a hold: holdedCall: " + this.holdedCall.callId + " currentCall: " + this.currentCall.callId);
    } else {
        this.currentCall = call;
        if (call.incoming == true) {
            this.flashphonerListener.onIncomingCall(call.callId);
        }
        trace("Phone - It seems like a new call currentCall: " + this.currentCall.callId + " status: " + this.currentCall.status);
    }
};

Phone.prototype.callStatusListener = function (event) {
    var sipObject = event.sipMessageRaw;
    var call = event;
    trace("Phone - callStatusListener call id: " + call.callId + " status: " + call.status + " mediaProvider: " + call.mediaProvider);
    if (this.currentCall.callId == call.callId) {
        if (call.status == CallStatus.FINISH) {
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
        } else if (call.status == CallStatus.HOLD) {
            trace('Phone - ...Call on hold...');
        } else if (call.status == CallStatus.TALK) {
            trace('Phone - ...Talking...');
            SoundControl.getInstance().stopSound("RING");
        } else if (call.status == CallStatus.RING) {
            trace('Phone - ...Ringing...');
            if (this.isRingSoundAllowed()) {
                SoundControl.getInstance().playSound("RING");
            }
        } else if (call.status == CallStatus.RING_MEDIA) {
            trace('Phone - ...Ringing...');
            SoundControl.getInstance().stopSound("RING");
        } else if (call.status == CallStatus.BUSY) {
            SoundControl.getInstance().playSound("BUSY");
        } else if (call.status == CallStatus.SESSION_PROGRESS) {
            trace('Phone - ...Call in Progress...');
            SoundControl.getInstance().stopSound("RING");
        }
    } else {
        if (this.holdedCall.callId == call.callId) {
            if (call.status == CallStatus.FINISH) {
                trace("It seems we received FINISH status on holdedCall. Just do null the holdedCall.");
                this.holdedCall = null;
            }
        }
    }
};

Phone.prototype.onTransferStatusListener = function (event) {
    trace("Phone - onTransferStatusListener status:" + event.status + " incoming:" + event.incoming);
};

Phone.prototype.onTransferEventListener = function (event) {
    trace("Phone - onTransferEventListener status:" + event.status + " incoming:" + event.incoming);
};


Phone.prototype.messageStatusListener = function (event) {
    var message = event;
    trace("Phone - messageStatusListener id = " + message.id + " status = " + message.status);
};

Phone.prototype.onMessageListener = function (event) {
    var message = event;
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

    trace("Phone - onMessageListener id = " + message.id + " body = " + message.body);
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

Phone.prototype.recordingStatusListener = function (recordReport) {
    trace("Phone - recordingStatusListener: " + recordReport.report.mixedFilename);
};

Phone.prototype.subscriptionStatusListener = function (event) {
    var subscriptionObject = event.subscription;
    var sipObject = event.sipObject;
    trace("Phone - subscriptionStatusListener event: " + subscriptionObject.event + " expires: " + subscriptionObject.expires + " status: " + subscriptionObject.status + " terminate: " + subscriptionObject.terminate);
    trace("Phone - subscriptionStatusListener body: " + subscriptionObject.requestBody);
    if (subscriptionObject.event == "reg") {
        if (subscriptionObject.terminate) {
            this.disconnect();
        }
    }
};

Phone.prototype.xcapStatusListener = function (xcapResponse) {
    trace("Phone - xcapStatusListener " + xcapResponse);
    var xml = $.parseXML(xcapResponse.responseBody);
    var history = $(xml).find("history-list").find("history");
    if (history != null && history.length != 0) {
        if (ConfigurationLoader.getInstance().msrpCallee != null && ConfigurationLoader.getInstance().msrpCallee.length != 0) {
            this.msrpCall(ConfigurationLoader.getInstance().msrpCallee);
        }
    }
};

Phone.prototype.bugReportStatusListener = function (event) {
    trace("Phone - bugReportStatusListener; filename - " + event.filename);
};

Phone.prototype.onDataEventListener = function (event) {
    trace("Phone - onDataEventListener; received data " + event.data);
};

Phone.prototype.dataStatusEventListener = function (event) {
    trace("Phone - DataStatusEventListener; received status " + event.status);
};

Phone.prototype.errorStatusEvent = function (event) {
    var code = event.status;
    var sipObject = event.sipMessageRaw;
    trace("Phone - errorStatusEvent " + code);

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
    } else if (code == WCSError.REST_AUTHORIZATION_FAIL) {
        trace("Phone - ERROR - Rest authorization fail.");
        window.setTimeout("disconnect();", 3000);
    } else if (code == WCSError.REST_FAIL) {
        trace("Phone - ERROR - Rest fail.");
    }

    this.flashphonerListener.onError();
};

/* ------------- Additional interface functions --------- */
Phone.prototype.isCurrentCall = function (call) {
    return this.currentCall != null && this.currentCall.callId == call.callId;
};

Phone.prototype.isRingSoundAllowed = function () {
    try {
        if (ConfigurationLoader.getInstance().suppressRingOnActiveAudioStream) {
            trace("Phone - isRingSoundAllowed false");
            return false;
        }
    } catch (error) {
    }
    trace("Phone - isRingSoundAllowed true");
    return true;
};
