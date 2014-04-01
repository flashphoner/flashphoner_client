/*
 Copyright (c) 2011 Flashphoner
 All rights reserved. This Code and the accompanying materials
 are made available under the terms of the GNU Public License v2.0
 which accompanies this distribution, and is available at
 http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

 Contributors:
 Flashphoner - initial API and implementation

 This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers.
 Other license versions by negatiation. Write us support@flashphoner.com with any questions.
 */
var flashphoner;
var flashphoner_UI;
var flashphonerLoader;
var flashphonerListener;

// One call become two calls during TRANSFER case
// there is why we need at least two kinds of calls here
var currentCall = null;
var callee = '';
var callerLogin = '';
var registerRequired;
var isLogged = false;

var micVolume = 100;
var speakerVolume = 100;
var traceEnabled = true;
var intervalId = -1;
var proportion = 0;
var proportionStreamer = 0;
var callToken = "testcalltoken";

var timerHours = 0;
var timerMinutes = 0;
var timerSeconds = 0;
var timerTimeout;

var testInviteParameter = new Object;
testInviteParameter['param1'] = "value1";
testInviteParameter['param2'] = "value2";

var logs="";

function timer() {

    if (timerHours < 10) {
        mTimerHours = "0" + timerHours
    } else {
        mTimerHours = timerHours
    }
    if (timerMinutes < 10) {
        mTimerMinutes = "0" + timerMinutes
    } else {
        mTimerMinutes = timerMinutes
    }
    if (timerSeconds < 10) {
        mTimerSeconds = "0" + timerSeconds
    } else {
        mTimerSeconds = timerSeconds
    }

    $("#timer").html(mTimerHours + ":" + mTimerMinutes + ":" + mTimerSeconds);

    timerSeconds = timerSeconds + 1;

    if (timerSeconds == 60) {
        timerMinutes = timerMinutes + 1;
        timerSeconds = 0;
    }

    if (timerMinutes == 60) {
        timerHours = timerHours + 1;
        timerMinutes = 0;
    }

    timerTimeout = setTimeout("timer()", 1000);
}

$(document).ready(function () {
    changeCallStateInfo("...Loading...");
    flashphonerLoader = new FlashphonerLoader();
});


function loginByToken(token) {
    trace("Click2Call - loginByToken url: "+ document.URL+" token: "+ token);
    changeCallStateInfo("...Registering...");

    var pageUrl = document.URL;
    var result = flashphoner.loginByToken(flashphonerLoader.urlServer, token, pageUrl);
}

function getInfoAboutMe() {
    trace("Click2Call - getInfoAboutMe");
    return flashphoner.getInfoAboutMe();
}

function logoff() {
    trace("Click2Call - logoff");
    flashphoner.logoff();
}

function callByToken(token) {
    trace("Click2Call - callByToken "+ token);
    if (isLogged) {
        if (!hasAccessToAudio()) {
            intervalId = setInterval('if (hasAccessToAudio()){flashphoner_UI.closeRequestUnmuteC2C(); clearInterval(intervalId);callByToken(callToken);}', 500);
            flashphoner_UI.requestUnmuteC2C();
        } else if (hasAccessToAudio()) {
            var callRequest = {};
            callRequest.token = token;
            callRequest.inviteParameters = testInviteParameter;
            callRequest.isMsrp = false;
            callRequest.hasVideo = false;
            var result = flashphoner.callByToken(callRequest);
            if (result == 0) {
                changeCallStateInfo("...Calling...");
                toHangupState();
                flashphonerListener.onCall();
            }
        } else {
            openInfoView("Microphone is not plugged in", 3000);
        }
    } else {
        if (flashphonerLoader.getToken()) {
            loginByToken(flashphonerLoader.getToken());
        } else {
            console.log("Please, specify token in flashphoner.xml!");
        }
    }
}

function hangup(callId) {
    trace("Click2Call - hangup "+ callId);
    flashphoner.hangup(callId);
    flashphonerListener.onHangup();
}

function sendDTMF(callId, dtmf) {
    trace("Click2Call - sendDTMF callId: "+ callId+" dtmf: "+ dtmf);
    flashphoner.sendDTMF(callId, dtmf);
}

// TODO change img to background
function sendVideoChangeState() {
    trace("Click2Call - sendVideoChangeState");
    var sendVideoButton = $('.sendVideoButton');
    var sendVideoButtonImage = $('#sendVideoButtonImage');

    if (sendVideoButton.hasClass('on')) {
        sendVideoButton.toggleClass('on');
        sendVideoButtonImage.attr('src', 'assets/c2c_play.png')
        flashphoner.setSendVideo(false);
    } else {
        sendVideoButton.toggleClass('on');
        sendVideoButtonImage.attr('src', 'assets/c2c_pause.png')
        flashphoner.setSendVideo(true);
    }
}

function initSendVideoButton() {
    var sendVideoButton = $('.sendVideoButton');
    var sendVideoButtonImage = $('#sendVideoButtonImage');
    if (sendVideoButton.hasClass('on')) {
        sendVideoButton.toggleClass('on');
        sendVideoButtonImage.attr('src', 'assets/c2c_play.png');
        flashphoner.setSendVideo(false);
    }
}

function changeRelationMyVideo(relation) {
    trace("Click2Call - changeRelationMyVideo "+ relation);
    flashphoner.changeRelationMyVideo(relation);
}

function getMicVolume() {
    var ret = flashphoner.getMicVolume();
    trace("Click2Call - getMicVolume "+ret);
    return ret;
}
function getVolume() {
    var ret = flashphoner.getVolume();
    trace("Click2Call - getVolume "+ret);
    return ret;
}

function getVersion() {
    var ret = flashphoner.getVersion();
    trace("Click2Call - getVersion "+ret);
    return ret;
}

function hasAccessToAudioAndVideo() {
    return hasAccessToAudio() && hasAccessToVideo();
}

function hasAccessToAudio() {
    return flashphoner.hasAccessToAudio();
}

function hasAccessToVideo() {
    return flashphoner.hasAccessToVideo();
}
/* ------------------ Notify functions ----------------- */

function addLogMessage(message) {
    trace('Click2Call - addLogMessage '+ message);
}

function notifyConfigLoaded() {
    trace("Click2Call - notifyConfigLoaded");
    flashphoner = flashphonerLoader.getFlashphoner();
    flashphoner_UI = flashphonerLoader.getFlashphonerUI();
    flashphonerListener = flashphonerLoader.getFlashphonerListener();
    if (flashphonerLoader.useWebRTC) {
        $('#cameraButton').css('visibility', 'hidden');
        $('#micButton').css('visibility', 'hidden');
    } else {
        $("#micSlider").slider("option", "value", getMicVolume());
    }

    if (flashphonerLoader.getToken()) {
        loginByToken(flashphonerLoader.getToken());
    } else {
        console.log("Please, specify token in flashphoner.xml!");
    }
    $("#speakerSlider").slider("option", "value", getVolume());
}

function notifyRegisterRequired(registerR) {
    registerRequired = registerR;
}

function notifyCloseConnection() {
    trace("Click2Call - notifyCloseConnection");
    currentCall = null;
    toCallState();
    isLogged = false;
    closeVideoView();
    initSendVideoButton();
    changeCallStateInfo("Finished");
}

function notifyConnected() {
    trace("Click2Call - notifyConnected");
    if (!registerRequired) {
        isLogged = true;
        callByToken(callToken);
    }
}

function notifyRegistered() {
    trace("Click2Call - notifyRegistered");
    if (registerRequired) {
        changeCallStateInfo("Registered");
        isLogged = true;
        flashphonerListener.onRegistered();
        callByToken(callToken);
    }
}

function notifyBalance(balance) {
}

// This functions invoked every time when call state changed
function notify(call) {
    trace('Click2Call - notify call_id: '+ call.id +' call.anotherSideUser: '+ call.anotherSideUser);
    if (call.incoming) {
        //do nothing because we already hangup this call in notifyAddCall()
        return;
    }
    if (currentCall.id == call.id) {
        currentCall = call;
        if (currentCall.visibleNameCallee != null) {
            if (currentCall.visibleNameCallee.length > 11) {
                $('#caller').css('font-size', 20);
                $('#caller').css('top', 95);
            }
            $('#caller').html(currentCall.visibleNameCallee.replace(/^<|>$/g, ""));
        } else {
            $('#caller').html(currentCall.callee);
        }
        // if we finish the call
        if (call.state == STATE_FINISH) {
            proportion = 0;
            closeVideoView();
            initSendVideoButton();
            changeCallStateInfo("Finished");
            toCallState();
            flashphoner.stopSound("RING");
            flashphoner.playSound("FINISH");

            timerMinutes = 0;
            timerHours = 0;
            timerSeconds = 0;
            $("#timer").hide();
            clearTimeout(timerTimeout);
            // if call is holded
        } else if (call.state == STATE_HOLD) {
            changeCallStateInfo("...Holded...");
            // or if call is started talk
        } else if (call.state == STATE_TALK) {
            changeCallStateInfo("...Talking...");
            flashphoner.stopSound("RING");
            timer();
            $("#timer").show();
            // or if we just ringing
        } else if (call.state == STATE_RING) {
            changeCallStateInfo("...Ringing...");
            flashphoner.playSound("RING");
        } else if (call.state == STATE_BUSY) {
            flashphoner.playSound("BUSY");
            changeCallStateInfo("Busy");
        }
    }
}

function notifyCallbackHold(call, isHold) {
}

function notifyCost(cost) {
}

function notifyBugReport(filename) {
    trace("Created bug report; filename - " + filename);
}

function notifyError(error) {

    trace("Click2Call - notifyError "+ error);

    if (error == CONNECTION_ERROR || error == TOO_MANY_REGISTER_ATTEMPTS ||
        error == LICENSE_RESTRICTION || error == LICENSE_NOT_FOUND ||
        error == REGISTER_EXPIRE || error == MEDIA_PORTS_BUSY) {
        openInfoView("Connection error, try later", 3000);
    } else if (error == AUTHENTICATION_FAIL || error == SIP_PORTS_BUSY ||
        error == WRONG_SIPPROVIDER_ADDRESS) {
        openInfoView("Connection error, try later", 3000);
        window.setTimeout("logoff();", 3000);
    } else if (error == USER_NOT_AVAILABLE) {
        openInfoView("Support is offline", 3000);
    } else if (error == INTERNAL_SIP_ERROR) {
        openInfoView("Unknown error", 3000);
    }
    toCallState();
    flashphonerListener.onError();
}

function notifyVideoFormat(call) {
    trace("Click2Call - notifyVideoFormat "+ call.id);

    // proportionStreamer allow us change proportion of small video window (myself preview video)
    if (call.streamerVideoWidth != 0) {
        proportionStreamer = call.streamerVideoHeight / call.streamerVideoWidth;
        if (proportionStreamer != 0) {
            /** Here we change size of small myself preview video window in the swf from the js code.
             * To be precise we cnahge only height, width is fixed and equal to 20% of big video.
             */
            changeRelationMyVideo(proportionStreamer);
        }
    }

    if (!call.playerVideoHeight == 0) { //that mean other side really send us video
        proportion = call.playerVideoHeight / call.playerVideoWidth; //set proportion of video picture, else it will be = 0
        var newHeight = 320 * proportion;
        $('.video').height(newHeight);
        $('#video').height(newHeight).width(320);
        //$('#c2c').height(newHeight+40);
    }
}

function notifyOpenVideoView(isViewed) {
    trace("Click2Call - notifyOpenVideoView: isViewed: " + isViewed);
    if (isViewed) {
        openVideoView('big');
    } else {
        closeVideoView();
    }
}

function notifyMessage(messageObject) {
    trace('Click2Call - notifyMessage from: '+ messageObject.from+' body: '+ messageObject.body);
}

function notifyAddCall(call) {
    trace("Click2Call - notifyAddCall call.id: "+ call.id +" call.anotherSideUser: "+ call.anotherSideUser);
    if (call.incoming == true) {
        hangup(call.id);
    } else {
        currentCall = call;
        $('#caller').html(currentCall.anotherSideUser);
    }
}

function notifyRemoveCall(call) {
    trace("Click2Call - notifyRemoveCall "+ call.id);
    if (currentCall != null && currentCall.id == call.id) {
        currentCall = null;
        flashphonerListener.onRemoveCall();
    }
}

function notifyVersion(version) {
    getElement('versionOfProduct').innerHTML = version;
}
/* ----------------------------------------------------------------------- */

function openInfoView(str, timeout) {
    if (timeout != 0) {
        window.setTimeout("closeInfoView();", timeout);
    }
    getElement('infoDiv').style.visibility = "visible";
    getElement('infoDiv').innerHTML = str;
}

function changeCallStateInfo(str) {
    $('#callState').html(str);
}

function closeInfoView(timeout) {
    trace("Click2Call - closeInfoView "+timeout);
    if (timeout != 0) {
        window.setTimeout("getElement('infoDiv').style.visibility = 'hidden';", timeout);
    } else {
        getElement('infoDiv').style.visibility = "hidden";
    }
}

function openSettingsView() {
    trace("Click2Call - openSettingsView");
    getElement('settingsDiv').style.visibility = "visible";
}
function closeSettingsView() {
    trace("Click2Call - closeSettingsView");
    getElement('settingsDiv').style.visibility = "hidden";
}

function getElement(str) {
    return document.getElementById(str);
}

function toHangupState() {
    trace("Click2Call - toHangupState");
    $('#callButton').html('Hangup').addClass('hangup').removeClass('call');
    disableCallButton();
}

function toCallState() {
    trace("Click2Call - toCallState");
    $('#callButton').html('Call').addClass('call').removeClass('hangup');
    disableCallButton();
}

function disableCallButton() {
    trace("Click2Call - disableCallButton");
    var button = $('#callButton');

    $('#callButton').addClass('disabled');
    window.setTimeout(enableCallButton, 3000);

    function enableCallButton() {
        $('#callButton').removeClass('disabled');
    }
}

/* ----- VIDEO ----- */

function openVideoView(size) {
    trace("Click2Call - openVideoView "+ size);
    flashphoner_UI.openVideoView();
    $('#cameraButton').addClass('pressed');
    // if we already give access to devices when trying to open video view
    if (hasAccessToVideo()) {

        // show send my video button
        $('.sendVideoButton').show();

        // if we need show only myself video (when other side dont send us video)
        // or if we need show both videos - ourselves and partner`s
        if ((size == 'big') && (proportion != 0)) { // sometimes voip servers send video with null sizes. Here we defend from such cases
            $('#flash').removeClass('init').addClass('video');
            var newHeight = 320 * proportion;
            $('.video').height(newHeight);
            $('#video').height(newHeight).width(320);
            $('#c2c').height(newHeight + 40);
        } else if (size == 'small') {
            $('#flash').removeClass('init').addClass('video');
            $('#video').height(240).width(320);
        } else {
            $('#flash').removeClass('init').addClass('video');
            $('#video').height(240).width(320);

        }

        // or if we did not access the devices yet
    } else {
        flashphoner_UI.requestUnmuteC2C();
        intervalId = setInterval('if (hasAccessToVideo()){flashphoner_UI.closeRequestUnmuteC2C(); clearInterval(intervalId); openVideoView("small");}', 500);
    }
}

function closeVideoView() {
    trace("Click2Call - closeVideoView");
    // turn flash div back to init size
    $('#flash').removeClass().removeAttr('style').addClass('init');
    // turn c2c div back to init size  
    $('#c2c').height(240);
    // hide send video button
    $('.sendVideoButton').hide();
    // unpressed camerabutton
    $('#cameraButton').removeClass('pressed');
}

// functions closeView is simplifying of many close....View functions
function close(element) {
    element.css('visibility', 'hidden');
}

/* TODO make good auto trace                       
 function getFnName(fn) {
 return fn.toString().match(/function ([^(]*)\(/)[1];
 }
 */


/* --------------------- On document load we do... ------------------ */
$(function () {

    // load c2c interface in frame c2c-test for showing in popup
    // $('#c2c-test').load('Click2callJS.html', alert('done'));

    // All buttons except .call and .hangup stay in press state until double click
    $(".button:not(.dialButton, .call, .hangup, .disabled)").click(function () {
        $(this).toggleClass('pressed');
    });

    // All dial buttons and call/hangup go unpressed after mouseup. Except if it disabled mode. 
    $('.dialButton, .call, .hangup').mousedown(function () {
        if (!$(this).hasClass('disabled')) {
            $(this).addClass('pressed');
        }
    }).mouseup(function () {
            $(this).removeClass('pressed');
        }).mouseover(function () {
            $(this).removeClass('pressed');
        });

    // dialpad button opens dialpad
    $("#dialpadButton").click(function () {
        if ($(this).hasClass('pressed')) {
            $('#dialPad').show();
        } else {
            $('#dialPad').hide();
        }
    });

    // dialButtons sends DTMF signals
    $(".dialButton").click(function () {
        if (currentCall != null && currentCall.state == STATE_TALK) {
            sendDTMF(currentCall.id, $(this).html());
            var dialScreenText = $('.dialScreen').html();
            if (dialScreenText.length > 10) {
                $('.dialScreen').html(dialScreenText.substr(1) + $(this).html());
            } else {
                $('.dialScreen').append($(this).html());
            }
        }
    });

    // mic button opens mic slider
    $("#micButton").click(function () {
        if ($(this).hasClass('pressed')) {
            $('#micSlider').show();
            $('#micBack').show();
        } else {
            $('#micSlider').hide();
            $('#micBack').hide();
        }
    });

    // sound button opens sound slider
    $("#soundButton").click(function () {
        if ($(this).hasClass('pressed')) {
            $('#speakerSlider').show();
            $('#speakerBack').show();
        } else {
            $('#speakerSlider').hide();
            $('#speakerBack').hide();
        }
    });

    // call button makes call or hangup
    $("#callButton:not(.disabled)").click(function () {
        if (!$(this).hasClass('disabled')) {
            if ($(this).html() == 'Call') {
                callByToken(callToken);
            } else {
                hangup(currentCall.id);
            }
        }
    });


    // call me  button opens new window with click2call
    $("#callMeButton1:not(.disabled)").click(function () {
        window.open('click2call-test-1.html', '_blank', 'width=340,height=260,resizable=no,toolbar=no,menubar=no,location=no,status=no,scrollbar=no')
    });

    $("#callMeButton2:not(.disabled)").click(function () {
        window.open('click2call-test-2.html', '_blank', 'width=340,height=260,resizable=no,toolbar=no,menubar=no,location=no,status=no,scrollbar=no')
    });

    $("#callMeButton3:not(.disabled)").click(function () {
        window.open('click2call-test-3.html', '_blank', 'width=340,height=260,resizable=no,toolbar=no,menubar=no,location=no,status=no,scrollbar=no')
    });

    // Mic slider set mic volume when you slide it
    $("#micSlider").slider({
        orientation: "vertical",
        range: "min",
        min: 0,
        max: 100,
        value: 60,
        slide: function (event, ui) {
            flashphoner.setMicVolume(ui.value);
        }
    });

    // Speaker slider set speaker volume when you slide it
    $("#speakerSlider").slider({
        orientation: "vertical",
        range: "min",
        min: 0,
        max: 100,
        value: 60,
        slide: function (event, ui) {
            flashphoner.setVolume(ui.value);
        }
    });

    // Camera button opens video window.
    // Depends on situation it can be both video or just my video
    $("#cameraButton").click(function () {
        if ($(this).hasClass('pressed')) {
            $('.sendVideoButton').show();
            if (proportion != 0) {
                openVideoView('big');
            } else {
                openVideoView('small');
            }
        } else {
            $('.sendVideoButton').hide();
            closeVideoView();
        }
    });

    // bind effects to click on send video button
    // and toggle video on/off by clicking
    $('.sendVideoButton').mousedown(function () {
        $(this).addClass('sendVideoButtonPressed');
    }).mouseup(function () {
            $(this).removeClass('sendVideoButtonPressed');
        }).mouseover(function () {
            $(this).removeClass('sendVideoButtonPressed');
        }).click(function () {
            sendVideoChangeState();
        });

    // Settings button button opens settings view  
    $("#settingsButton").click(function () {
        if ($(this).hasClass('pressed')) {

            $("#settingsView").show();

            var micList = flashphoner.getMicropones();
            var camList = flashphoner.getCameras();

            //clear it each time, else we append it more and more...
            $("#micSelector").html("");
            $("#camSelector").html("");

            for (var i = 0; i < micList.length; i++) {
                $("#micSelector").append('<option value="' + micList[i] + '">' + micList[i] + '</option>');
            }

            // we use here index instead of name because AS getcamera can only use indexes
            for (var i = 0; i < camList.length; i++) {
                $("#camSelector").append('<option value="' + i + '">' + camList[i] + '</option>');
            }

        } else {
            $("#settingsView").hide();
        }
    });


    $("#micSelector").change(function () {
        flashphoner.setMicrophone($(this).val());
        trace('Click2Call - Microphone was changed to '+ $(this).val());
    });

    $("#camSelector").change(function () {
        flashphoner.setCamera($(this).val());
        trace('Click2Call - Camera was changed to '+ $(this).val());
    });

    $("#settingsOkButton").click(function () {
        $("#settingsView").hide();
        $("#settingsButton").removeClass("pressed");
    });

});



	