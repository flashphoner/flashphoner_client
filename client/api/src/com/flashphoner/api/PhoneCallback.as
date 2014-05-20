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
package com.flashphoner.api
{	
	
	import com.adobe.cairngorm.control.CairngormEventDispatcher;
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.ModelLocator;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	
	import flash.external.ExternalInterface;
	import flash.net.NetConnection;
	import flash.net.NetStream;

	public class PhoneCallback
	{	
		private var flash_API:Flash_API;
		public function PhoneCallback(flashAPI:Flash_API)
		{
			this.flash_API = flashAPI; 
		}
		
		public function ping():void{
			this.flash_API.pong();
		}
		
		public function notifyBalance(balance:Number,_sipObject:Object):void{
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyBalance(balance,_sipObject);
			}
		}	
		
		public function notifyBugReport(filename:String):void{
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyBugReport(filename);
			}
		}	
				
		public function getVersion(version:String):void{
			PhoneConfig.VERSION_OF_SERVER = version;
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyVersion(PhoneConfig.getFullVersion());
			}
		}
		
		public function getUserData(resObj:Object):void{
			var modelLocator:ModelLocator = flash_API.modelLocator;
			modelLocator.login = resObj.login;
			modelLocator.pwd = resObj.password;
			modelLocator.outboundProxy = resObj.outboundProxy;
			modelLocator.domain = resObj.domain;
			modelLocator.port = resObj.port;
			
			PhoneConfig.REGISTER_REQUIRED = resObj.regRequired;
			ExternalInterface.call("notifyRegisterRequired",PhoneConfig.REGISTER_REQUIRED);
			if (PhoneConfig.REGISTER_REQUIRED){
				flash_API.upRegisteredTimer();
				flash_API.startRegisterTimer();
			}
		}
		
		public function fail(errorCode:String,_sipObject:Object):void{
			Logger.info("PhoneCallback.fail() "+errorCode);
			if (errorCode == ErrorCodes.AUTHENTICATION_FAIL || errorCode == ErrorCodes.SIP_PORTS_BUSY){
				flash_API.dropRegisteredTimer();
			}			
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyError(errorCode,_sipObject);
			}
		}
		
		public function close():void{
		}
		
		public function registered(_sipObject:Object):void{
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyRegistered(_sipObject);
			}
			CairngormEventDispatcher.getInstance().dispatchEvent(new MainEvent(MainEvent.REGISTERED,flash_API));
		}
		
		public function ring(_call:Object,_sipObject:Object):void{
			var call:Call = process(_call);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notify(call,_sipObject);
			}
			if (!call.incoming){
				CairngormEventDispatcher.getInstance().dispatchEvent(new CallEvent(CallEvent.OUT,call));
			} else {
				CairngormEventDispatcher.getInstance().dispatchEvent(new CallEvent(CallEvent.IN,call));
			}
		}
		
		public function sessionProgress(_call:Object,_sipObject:Object):void{
			var call:Call = process(_call);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notify(call,_sipObject);
			}
			CairngormEventDispatcher.getInstance().dispatchEvent(new CallEvent(CallEvent.SESSION_PROGRESS,call));
		}
		
		public function talk(_call:Object,_sipObject:Object):void{
			var call:Call = process(_call);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notify(call,_sipObject);
			}
			CairngormEventDispatcher.getInstance().dispatchEvent(new CallEvent(CallEvent.TALK,call));
		}
		
		public function hold(_call:Object, _sipObject:Object):void{
			var call:Call = process(_call);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notify(call,_sipObject);
			}
			CairngormEventDispatcher.getInstance().dispatchEvent(new CallEvent(CallEvent.HOLD,call));
		}
		
		// Notify about CIF 352x288 or QCIF 176x144 video format 
		public function notifyVideoFormat(videoFormat:Object):void{
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyVideoFormat(videoFormat);			
			}
			var event:MainEvent = new MainEvent(MainEvent.VIDEO_FORMAT_CHANGED, flash_API);
			event.obj = videoFormat;
			CairngormEventDispatcher.getInstance().dispatchEvent(event);
		}
		
		public function onVideoPlay(_call:Object, play:Boolean):void{
			var call:Call = process(_call);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyOpenVideoView(play);			
			}
		}		
		
		public function callbackHold(callId:String, isHold:Boolean):void{
			var call:Call = flash_API.getCallById(callId);
			call.iHolded = isHold;
			if (!isHold){
				for each (var tempCall:Call in flash_API.calls){
					if (tempCall.state == Call.STATE_TALK && tempCall.id != call.id){
						tempCall.setStatusHold(true);
					}
				}
			}
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyCallbackHold(call,isHold);
			}
		}
		
		public function busy(_call:Object,_sipObject:Object):void{
			var call:Call = process(_call);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notify(call,_sipObject);
			}
			CairngormEventDispatcher.getInstance().dispatchEvent(new CallEvent(CallEvent.BUSY,call));	
		}
		
		public function finish(_call:Object,_sipObject:Object):void{
			var call:Call = process(_call);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notify(call,_sipObject);
			}
			CairngormEventDispatcher.getInstance().dispatchEvent(new CallEvent(CallEvent.FINISH,call));
		}	
		
		public function process(_call:Object):Call{
			Logger.info("PhoneCallback.process() id="+_call.id+" state="+_call.state+" callee="+_call.callee);
			var call:Call = flash_API.getCallById(_call.id);
			if (call==null){
				call = new Call(flash_API);
				call.id = _call.id;	
			}

			call.incoming = _call.incoming;
			call.isVideoCall = _call.isVideoCall;
			call.callee = _call.callee;
			call.caller = _call.caller;
			if (call.incoming){
				call.anotherSideUser = _call.caller;
			}else{
				call.anotherSideUser = _call.callee;
			}
			call.visibleNameCallee = _call.visibleNameCallee;
			if (call.visibleNameCallee != null){
				call.visibleNameCallee = call.visibleNameCallee.replace("<","");
				call.visibleNameCallee = call.visibleNameCallee.replace(">","");
			}
			call.visibleNameCaller = _call.visibleNameCaller;
			if (call.visibleNameCaller != null){
				call.visibleNameCaller = call.visibleNameCaller.replace("<","");
				call.visibleNameCaller = call.visibleNameCaller.replace(">","");
			}
			call.state = _call.state;
			call.state_video = _call.state_video;
			call.sip_state = _call.sip_state;
			call.playerVideoHeight = _call.playerVideoHeight;
			call.playerVideoWidth = _call.playerVideoWidth;
			call.streamerVideoWidth = _call.streamerVideoWidth;
			call.streamerVideoHeight = _call.streamerVideoHeight;
		
			flash_API.addCall(call);			
			Logger.info("PhoneCallback.process() complete id="+call.id+" state="+call.state+" callee="+call.callee);
			return call;
		}
		
		public function notifyMessage(messageObj:Object, notificationResult:Object, sipObject:Object):void {
			Logger.info("Message has been accepted by other participant");
			var messageEvent:MessageEvent = new MessageEvent(MessageEvent.MESSAGE_EVENT,messageObj,flash_API);
			messageEvent.notificationResult = notificationResult;
			messageEvent.sipObject = sipObject;
			CairngormEventDispatcher.getInstance().dispatchEvent(messageEvent);		
		}
		
		public function notifyAudioCodec(codec:Object):void {
			Logger.info("notifyAudioCodec: "+codec);
			var event:MainEvent = new MainEvent(MainEvent.AUDIO_CODEC_CHANGED_EVENT,flash_API);
			event.obj = codec;
			CairngormEventDispatcher.getInstance().dispatchEvent(event);		
		}
		
		public function notifyOptions(sipObj:Object):int {
			Logger.info("notifyOptions "+sipObj);
			return 200;
		}
		
		public function notifySubscription(subscribtionObj:Object, sipObj:Object):void {
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifySubscription(subscribtionObj,sipObj);
			}
		}
		
		public function notifyXcapResponse(xcapResponse:String):void{
			Logger.info("notifyXcapResponse:\n"+xcapResponse);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.notifyXcapResponse(xcapResponse);
			}	
		}

		
		
	}
}
