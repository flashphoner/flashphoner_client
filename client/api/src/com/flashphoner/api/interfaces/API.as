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
package com.flashphoner.api.interfaces
{
	public interface API
	{
		function addAPINotify(apiNotify:APINotify):void;
		function getAPINotify():APINotify;
		function getParameters():Object;
		function login(username:String,password:String):int;
		function call(callee:String, visibleName:String, isVideoCall:Boolean = false):int;
		function hangup():void;
		function setStatusHold(isHold:Boolean):void;
		function transfer(callee:String):void;
		function answer(isVideoCall:Boolean = false):void;
		function isSendVideo(flag:Boolean):void;
		function sendDTMF(dtmf:String):void;
		function getMicVolume():int;
		function setMicVolume(volume:int):void;
		function getMicropones():Array;
		function setMicrophone(name:String):void;
		function getCameras():Array;
		function setCamera(name:String):void;
		function getVolume():int;
		function setVolume(volume:int):void;
		function logoff():void;
	}
}
