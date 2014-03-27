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
package com.flashphoner.api.js
{
	import com.flashphoner.api.Call;
	import com.flashphoner.api.interfaces.APINotify;
	
	import flash.external.ExternalInterface;
	
	/**
	 * Implementaion interface for js-phones
	 **/
	public class APINotifyJS implements APINotify
	{
		public function APINotifyJS()
		{
		}
		public function notifyCloseConnection():void{
			ExternalInterface.call("notifyCloseConnection");
		}
		public function notifyConnected():void{
			ExternalInterface.call("notifyConnected");
		}
		public function notifyRegistered(_sipObject:Object):void{
			ExternalInterface.call("notifyRegistered", _sipObject);
		}
		public function notifyBalance(balance:Number,_sipObject:Object):void{
			ExternalInterface.call("notifyBalance",String(balance));
		}
		public function notify(call:Call,_sipObject:Object):void{
			ExternalInterface.call("notify",call, _sipObject);
		}
		public function notifyCallbackHold(call:Call,isHold:Boolean):void{
			ExternalInterface.call("notifyCallbackHold",call,isHold);
		}
		
		public function notifyCost(call:Call,cost:Number):void{
			ExternalInterface.call("notifyCost",call.id,String(cost));
		}

		public function notifyError(error:String,_sipObject:Object = null):void{
			ExternalInterface.call("notifyError",error);
		}
		
		public function notifyVideoFormat(videoFormat:Object,_sipObject:Object = null):void{
			ExternalInterface.call("notifyVideoFormat",videoFormat);
		}
		
		public function notifyOpenVideoView(isViewed:Boolean):void{
			ExternalInterface.call("notifyOpenVideoView",isViewed);
		}
		
		public function notifyMessage(messageObject:Object, notifyMessageResult:Object, sipObject:Object):void{
			ExternalInterface.call("notifyMessage",messageObject, notifyMessageResult, sipObject);
		}
		
		public function notifyAddCall(call:Call):void{
			ExternalInterface.call("notifyAddCall",call);
		}
		
		public function notifyRemoveCall(call:Call):void{
			ExternalInterface.call("notifyRemoveCall",call);
		}
		
		public function notifySubscription(subscribtionObj:Object, sipObj:Object):void {
			ExternalInterface.call("notifySubscription", subscribtionObj, sipObj);
		}
		
		public function addLogMessage(message:String):void{
			ExternalInterface.call("addLogMessage", message);
		}

		public function notifyVersion(version:String):void{
			ExternalInterface.call("notifyVersion", version);
		}
		
		public function notifyXcapResponse(xcapResponse:String):void{
			ExternalInterface.call("notifyXcapResponse", xcapResponse);
		}
		
	}
}
