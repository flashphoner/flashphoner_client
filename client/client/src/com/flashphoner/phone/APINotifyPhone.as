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
package com.flashphoner.phone
{
	import com.flashphoner.api.Call;
	import com.flashphoner.api.Flash_API;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	
	import mx.controls.Alert;
	import mx.core.Application;
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
			DataPhone.getInstance().viewController.closedConnectingView();
			phone(Application.application).toLoggedOffState();
			phone(Application.application).videoView.stopVideo();
			phone(Application.application).videoView.onCloseClick();
			DataPhone.getInstance().viewController.hideIncomingView();
		}
		public function notifyConnected():void{
				if (!PhoneConfig.REGISTER_REQUIRED){				
					DataPhone.getInstance().sipAccountView.close();
					phone(Application.application).toLoggedState();
					DataPhone.getInstance().viewController.hideConnectingView();
				} else {
					DataPhone.getInstance().viewController.waitingForRegisteredConnectionView();
				}			
		}
		public function notifyRegistered(_sipObject:Object):void{
			if (PhoneConfig.REGISTER_REQUIRED){				
				DataPhone.getInstance().sipAccountView.close();
				phone(Application.application).toLoggedState();
				DataPhone.getInstance().viewController.hideConnectingView();
			}			

		}
		public function notifyBalance(balance:Number,_sipObject:Object):void{
			
		}
		public function notify(call:Call,_sipObject:Object):void{
			if (call.state == Call.STATE_FINISH){
				DataPhone.getInstance().viewController.hideIncomingView();	
				phone(Application.application).videoView.onCloseClick();			
			}else if (call.state == Call.STATE_HOLD){
				DataPhone.getInstance().getCallView(call.id).callHolded();
			}else if (call.state == Call.STATE_TALK){
				DataPhone.getInstance().getCallView(call.id).callUnholded();
			}
		}
		
		public function notifyCallbackHold(call:Call,isHold:Boolean):void{
			DataPhone.getInstance().getCallView(call.id).iHolded(isHold);
		}
		
		public function notifyCost(call:Call,cost:Number):void{
			
		}

		public function notifyError(error:String,_sipObject:Object=null):void{
			if (error == ErrorCodes.CONNECTION_ERROR){				
				DataPhone.getInstance().viewController.failConnectionView();				
			} else
			if (error == ErrorCodes.AUTHENTICATION_FAIL){				
				DataPhone.getInstance().viewController.failRegisterView();
			} else
			if (error == ErrorCodes.USER_NOT_AVAILABLE){
				DataPhone.getInstance().viewController.calleeNotFoundView();	
			} else if (error==ErrorCodes.TOO_MANY_REGISTER_ATTEMPTS){
				mx.controls.Alert.show("Connection error");
				phone(Application.application).toLoggedOffState();
			} else if (error==ErrorCodes.LICENSE_RESTRICTION){
				mx.controls.Alert.show("License restriction:\n'Trial period has been expired' \nOR 'Too many connects'.\n Check the serial number.");
			} else if (error==ErrorCodes.LICENSE_NOT_FOUND){
				mx.controls.Alert.show("Please set the license key.\nYou can get it here -\nwww.flashphoner.com/license.");
			} else if (error==ErrorCodes.INTERNAL_SIP_ERROR){
				mx.controls.Alert.show("There is a SIP problem in \nFlashphoner side or your SIP-provider side.\nPlease send logs and other info\n to Flashphoner support team.");
			} else if (error == ErrorCodes.REGISTER_EXPIRE){
				DataPhone.getInstance().viewController.registerAttemptExpire();	
			} else if (error == ErrorCodes.SIP_PORTS_BUSY){
				DataPhone.getInstance().viewController.sipPortsBusyView();	
			} else if (error == ErrorCodes.MEDIA_PORTS_BUSY){
				DataPhone.getInstance().viewController.mediaPortsBusyView();
			} else if (error == ErrorCodes.WRONG_SIPPROVIDER_ADDRESS){
				DataPhone.getInstance().viewController.wrongSipProviderAddressView();	
			}			
		} 
		
		public function notifyVideoFormat(call:Call,_sipObject:Object = null):void{
		}
		
		public function notifyOpenVideoView(isViewed:Boolean):void{
			if (isViewed){
				phone(Application.application).onOpenVideoView();
			}else{
				phone(Application.application).videoView.onCloseClick();				
			}
		}
		
		public function notifyMessage(messageObject:Object, _sipObject:Object):void {
			DataPhone.getInstance().viewController.pushMessageToInstantMessageChatView(messageObject);			
		}	
		
		public function notifyAddCall(call:Call):void{
			if (call.incoming){
				DataPhone.getInstance().viewController.showIncomingView(call);
			}
		}
		
		public function notifyRemoveCall(call:Call):void{
		}			

		public function addLogMessage(message:String):void{
			
		}
		
		public function notifyVersion(version:String):void{
			DataPhone.getInstance().version = version;
		}
		
		public function notifySubscription(subscriptionObject:Object, _sipObject:Object):void{
			
		}		
		
	}
}
