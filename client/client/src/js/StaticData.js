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
var STATE_RING = "RING";
var STATE_RING_MEDIA = "RING_MEDIA";
var STATE_HOLD = "HOLD";
var STATE_TALK = "TALK";
var STATE_FINISH = "FINISH";
var STATE_BUSY = "BUSY";
var STATE_SESSION_PROGRESS = "SESSION_PROGRESS";

var AUTHENTICATION_FAIL = "AUTHENTICATION_FAIL";
var USER_NOT_AVAILABLE = "USER_NOT_AVAILABLE";
var TOO_MANY_REGISTER_ATTEMPTS = "TOO_MANY_REGISTER_ATTEMPTS";
var LICENSE_RESTRICTION = "LICENSE_RESTRICTION";
var LICENSE_NOT_FOUND = "LICENSE_NOT_FOUND";
var INTERNAL_SIP_ERROR = "INTERNAL_SIP_ERROR";
var CONNECTION_ERROR = "CONNECTION_ERROR";
var REGISTER_EXPIRE = "REGISTER_EXPIRE";	
var SIP_PORTS_BUSY = "SIP_PORTS_BUSY";	
var MEDIA_PORTS_BUSY = "MEDIA_PORTS_BUSY";	
var WRONG_SIPPROVIDER_ADDRESS = "WRONG_SIPPROVIDER_ADDRESS";
var CALLEE_NAME_IS_NULL = "CALLEE_NAME_IS_NULL";
var WRONG_FLASHPHONER_XML = "WRONG_FLASHPHONER_XML";
var PAYMENT_REQUIRED = "PAYMENT_REQUIRED";

var isMobile = {
    Android: function() {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function() {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function() {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function() {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Windows: function() {
        return navigator.userAgent.match(/IEMobile/i);
    },
    any: function() {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    }

};

function extend(Child, Parent) {
    var F = function() { }
    F.prototype = Parent.prototype
    Child.prototype = new F()
    Child.prototype.constructor = Child
    Child.superclass = Parent.prototype
}

function trace(logMessage) {

    var today = new Date();
    // get hours, minutes and seconds
    var hh = today.getUTCHours().toString();
    var mm = today.getUTCMinutes().toString();
    var ss = today.getUTCSeconds().toString();
    var ms = today.getUTCMilliseconds().toString();

    // Add leading '0' to see 14:08:06.001 instead of 14:8:6.1
    hh = hh.length == 1 ? "0" + hh : hh;
    mm = mm.length == 1 ? "0" + mm : mm;
    ss = ss.length == 1 ? "0" + ss : ss;
    ms = ms.length == 1 ? "00" + ms : ms.length == 2 ? "0" + ms : ms;

    // set time
    var time = "UTC " + hh + ':' + mm + ':' + ss + '.' + ms;

    var console = $("#console");

    // Check if console is scrolled down? Or may be you are reading previous messages.
    var isScrolled = (console[0].scrollHeight - console.height() + 1) / (console[0].scrollTop + 1 + 37);

    var logMessage =  time + ' - ' + logMessage;

    // Print message to console and push it to server
    if (traceEnabled) {
        //check if API already loaded
        if (flashphoner !== undefined) {
            //check if push_log enabled
            if (flashphonerLoader.pushLogEnabled) {
                var result = flashphoner.pushLogs(logs + logMessage+'\n');
                if (!result) {
                    logs += logMessage+'\n';
                } else {
                    logs = "";
                }
            } else {
                logs = "";
            }

        } else {
            logs += logMessage+'\n';
        }

        console.append(logMessage+'<br>');
        try {
            window.console.debug(logMessage);
        } catch(err) {
            //Not supported. For example IE
        }

    }

    //Autoscroll cosole if you are not reading previous messages
    if (isScrolled < 1) {
        console[0].scrollTop = console[0].scrollHeight;
    }
}