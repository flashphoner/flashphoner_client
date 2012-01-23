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
	import com.flashphoner.api.Call;

	public interface APINotify
	{
		function notifyCloseConnection():void;
		function notifyConnected():void;
		function notifyRegistered(_sipObject:Object):void;
		function notifyCallbackHold(call:Call,isHold:Boolean):void;		
		function notify(call:Call,_sipObject:Object):void;
		function notifyCost(call:Call,cost:Number):void;
		function notifyBalance(balance:Number,_sipObject:Object):void;
		function notifyError(error:String,_sipObject:Object = null):void; 	
		function notifyVideoFormat(call:Call,_sipObject:Object = null):void;
		function notifyOpenVideoView(isViewed:Boolean):void;
		function notifyMessage(messageObject:Object):void;		
		function notifyAddCall(call:Call):void;
		function notifyRemoveCall(call:Call):void;
	
		function addLogMessage(message:String):void;
		function notifyVersion(version:String):void;
		function notifySubscribed(_sipObject:Object):void;
		function notifyRfc3265(_sipObject:Object):void;
	
	}
}
