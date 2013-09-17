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

function extend(Child, Parent) {
    var F = function() { }
    F.prototype = Parent.prototype
    Child.prototype = new F()
    Child.prototype.constructor = Child
    Child.superclass = Parent.prototype
}

function trace(funcName, param1, param2, param3) {

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

    var div1 = div2 = '';

    var console = $("#console");

    // Check if console is scrolled down? Or may be you are reading previous messages.
    var isScrolled = (console[0].scrollHeight - console.height() + 1) / (console[0].scrollTop + 1 + 37);

    // Check if we set params and set it ????? instead of 'undefined' if not, also set dividers equal to ', '
    if (typeof param1 == 'undefined') {
        param1 = '';
    }
    if (typeof param2 == 'undefined') {
        param2 = '';
    } else {
        var div1 = ', ';
    }
    if (typeof param3 == 'undefined') {
        param3 = '';
    } else {
        var div2 = ', ';
    }

    // Print message to console and push it to server
    if (traceEnabled) {
        //check if API already loaded
        if (flashphoner !== undefined) {
            //check if push_log enabled
            if (flashphonerLoader.pushLogEnabled) {
                var result = flashphoner.pushLogs(logs + time + ' - ' + funcName + ' ' + +param1 + div1 + param2 + div2 + param3 + '\n');
                if (!result) {
                    logs += time + ' - ' + funcName + ' ' + param1 + div1 + param2 + div2 + param3 + '\n';
                } else {
                    logs = "";
                }
            } else {
                logs = "";
            }

        } else {
            logs += time + ' - ' + funcName + ' ' + param1 + div1 + param2 + div2 + param3 + '\n';
        }
        console.append('<grey>' + time + ' - ' + '</grey>' + funcName + '<grey>' + ' ' + param1 + div1 + param2 + div2 + param3 + ' ' + '</grey>' + '<br>');
    }

    //Autoscroll cosole if you are not reading previous messages
    if (isScrolled < 1) {
        console[0].scrollTop = console[0].scrollHeight;
    }
}