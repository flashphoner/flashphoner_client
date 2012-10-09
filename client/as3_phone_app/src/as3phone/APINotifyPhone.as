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
package as3phone
{
	import com.flashphoner.api.Call;
	import com.flashphoner.api.Flash_API;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	
	import mx.controls.Alert;
	import mx.core.Application;
	import mx.core.FlexGlobals;
	import mx.messaging.errors.MessagingError;
	import mx.utils.object_proxy;
	
	/**
	 * Implementation APINotify for handler events
	 * Example: flash_API.addAPINotify(new APINotifyPhone())
	 **/
	public class APINotifyPhone implements APINotify
	{
		public function APINotifyPhone()
		{
		}
		public function notifyCloseConnection():void{
			trace("notifyCloseConnection");
		}
		public function notifyConnected():void{
			trace("notifyConnected");	
		}
		public function notifyRegistered(_sipObject:Object):void{
			if (PhoneConfig.REGISTER_REQUIRED){				
				trace("notifyRegistered");				
			}

		}
		public function notifyBalance(balance:Number,_sipObject:Object):void{
			trace("notifyBalance");
		}
		public function notify(call:Call,_sipObject:Object):void{
			trace("notify call state: "+call.state+" id: "+call.id);
			FlexGlobals.topLevelApplication.setCallId(call.id);			
		}
		
		public function notifyCallbackHold(call:Call,isHold:Boolean):void{
			trace("notifyCallbackHold");
		}
		
		public function notifyCost(call:Call,cost:Number):void{
			trace("notifyCost");	
		}

		public function notifyError(error:String,_sipObject:Object=null):void{
			trace("notifyError");		
		} 
		
		public function notifyVideoFormat(call:Call,_sipObject:Object = null):void{
			trace("notifyVideoFormat");		
		}
		
		public function notifyOpenVideoView(isViewed:Boolean):void{
			trace("notifyOpenVideoView");
		}
		
		public function notifyMessage(messageObject:Object):void {
			trace("notifyMessage");	
		}	
		
		public function notifyAddCall(call:Call):void{
			trace("notifyAddCall");	
		}
		
		public function notifyRemoveCall(call:Call):void{
			trace("notifyRemoveCall");	
		}			

		public function addLogMessage(message:String):void{
			trace("addLogMessage");	
		}
		
		public function notifyVersion(version:String):void{
			trace("notifyVersion");	
		}
	}
}
