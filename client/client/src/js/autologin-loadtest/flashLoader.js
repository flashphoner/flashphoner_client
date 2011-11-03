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
function trackBarChange(val)
{
}

function positionStatus(e){	
	flashphoner = e.ref;
}

var params = {};
params.menu = "true";
params.swliveconnect = "true";
params.allowfullscreen = "true";
params.allowscriptaccess = "always";
params.wmode = "transparent";
var attributes = {};
var flashvars = {};
flashvars.config = "flashphoner.xml";
$(function() {
  flashvars.token = $("#auto_login_token").val();
});

function playerIsRight(){
	return swfobject.hasFlashPlayerVersion("10.3"); 
}

if (playerIsRight()) {
	swfobject.embedSWF("flashphoner_js_api.swf", "jsSWFDiv", "100%", "100%", "10.0.12", "expressInstall.swf", flashvars, params, attributes, positionStatus);
}
