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
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.ModelLocator;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.API;
	import com.flashphoner.api.interfaces.APINotify;
	import com.flashphoner.api.js.APINotifyJS;
	import com.flashphoner.api.management.PhoneSpeaker;
	import com.flashphoner.api.management.VideoControl;
	
	import flash.events.TimerEvent;
	import flash.external.ExternalInterface;
	import flash.media.Camera;
	import flash.media.Microphone;
	import flash.net.Responder;
	import flash.net.SharedObject;
	import flash.utils.Timer;
	
	import mx.collections.ArrayCollection;

	[Bindable]
	public class Flash_API
	{
		private var registeredTimer:Timer;
		/**
		 * @private
		 **/
		internal var phoneServerProxy:PhoneServerProxy;
		/**
		 * List of calls
		 **/
		public var calls:ArrayCollection;	
		/**
		 * @private
		 * Notifier added by addNotify()
		 **/ 
		internal var apiNotifys:ArrayCollection;		
		/**
		 * Data about logged user
		 **/
		public var modelLocator:ModelLocator;
		
		/**
		 * management sounds and microphone
		 **/
		public var soundControl:SoundControl;
		
		/**
		 * Control of video
		 **/
		public var videoControl:VideoControl;

		/**
		 *
		 * Initialize parameters from 'flashphoner.xml' and another 
		 **/
		public static function initLibrary():void{
			PhoneModel.getInstance();
		}
		/**
		 * Default contructor.
		 * Initialize calls,modelLocato and initialize library
		 */		
		public function Flash_API(apiNotify:APINotify){
			apiNotifys = new ArrayCollection();
			addAPINotify(apiNotify);
			PhoneModel.getInstance();
			ExternalInterface.addCallback("getParameters",getParameters);
			ExternalInterface.addCallback("login",login);
			ExternalInterface.addCallback("loginWithToken",loginWithToken);
			ExternalInterface.addCallback("logoff",logoff);
			ExternalInterface.addCallback("getInfoAboutMe",getInfoAboutMe);			
			ExternalInterface.addCallback("sendMessage",sendMessage);
			ExternalInterface.addCallback("call",call);
			ExternalInterface.addCallback("callByToken",callByToken);
			ExternalInterface.addCallback("hangup",hangup);
			ExternalInterface.addCallback("answer",answer);
			ExternalInterface.addCallback("sendDTMF",sendDTMF);
			ExternalInterface.addCallback("setStatusHold",setStatusHold);
			ExternalInterface.addCallback("transfer",transfer);
			ExternalInterface.addCallback("setSendVideo",setSendVideo);
			ExternalInterface.addCallback("getMicVolume",getMicVolume);
			ExternalInterface.addCallback("setMicVolume",setMicVolume);
			ExternalInterface.addCallback("getVolume",getVolume);
			ExternalInterface.addCallback("setVolume",setVolume);
			ExternalInterface.addCallback("isMuted",isMuted);
			ExternalInterface.addCallback("getMicropones",getMicropones);
			ExternalInterface.addCallback("setMicrophone",setMicrophone);
			ExternalInterface.addCallback("getCameras",getCameras);
			ExternalInterface.addCallback("setCamera",setCamera);
			ExternalInterface.addCallback("getCurrentCall",getCurrentCall);
			ExternalInterface.addCallback("setCookie",setCookie);
			ExternalInterface.addCallback("getCookie",getCookie);
			ExternalInterface.addCallback("getVersion",getVersion);
			calls = new ArrayCollection();
			modelLocator = new ModelLocator();
			phoneServerProxy = new PhoneServerProxy(new Responder(result),this);			
			
		}
		
		public function initMedia():void{
			Logger.info("Init media...");
			soundControl = new SoundControl(this);
			videoControl = new VideoControl();
		}
		
		/**
		 * Hangup call by id
		 * @param callId Identifier of call
		 **/
		public function hangup(callId:String):void{
			var call:Call = getCallById(callId);
			if (call != null){
				call.hangup();
			}
		}

		/**
		 * Answer call by id
		 * @param callId Identifier of call
		 * @param isVideoCall video call?(true/false)
		 **/
		public function answer(callId:String, isVideoCall:Boolean = false):void{
			var call:Call = getCallById(callId);
			if (call != null){
				call.answer(isVideoCall);
			}
		}
		
		/**
		 * Send dtmf to voip server
		 * @param callId Identifier of call
		 * @param dtmf command for dtmf
		 **/		
		public function sendDTMF(callId:String,dtmf:String):void{
			var call:Call = getCallById(callId);
			if (call != null){
				call.sendDTMF(dtmf);
			}
		}		
		
		/**
		 * Hold/Unhold call
		 * @param callId Identifier of call
		 * @param isHold true, if set state hold
		 **/		
		public function setStatusHold(callId:String,isHold:Boolean = true):void{
			var call:Call = getCallById(callId);
			if (call != null){
				call.setStatusHold(isHold);
			}
		}
		
		/**
		 * Transfer call
		 * @param callId Identifier of call
		 * @param target target for transfer call
		 **/		
		public function transfer(callId:String,target:String):void{
			var call:Call = getCallById(callId);
			if (call != null){
				call.transfer(target);
			}
		}	
		
		/**
		 *  Start/stop video stream
		 * @param isSend true, if start(true/false)
		 **/		
		public function setSendVideo(isSend:Boolean):void{
			var call:Call = getCurrentCall();
			if (call != null){
				call.setSendVideo(isSend);
			}
		}
		
		/**
		 * Get current call in TALK-state
		 **/
		public function getCurrentCall():Call{
			for each(var obj:* in calls){
				if (obj.state == Call.STATE_TALK){
					return Call(obj);	
				}
			}
			return null;
		}
			
		/**
		 * Get call by indetifier
		 * @param callId Identifier of call
		 **/
		public function getCallById(callId:String):Call{
			for each(var obj:* in calls){
				if (obj.id == callId){
					return Call(obj);
				}
			}
			return null;
		}

		/**
		 * Get call by index 
		 * @param index Index in calls collection
		 **/		
		public function getCallByIndex(index:Number):Call{
			var obj:* = calls.getItemAt(index);
			if (obj != null){
				return Call(obj);	
			}
			return null;
		}	
		
		/**
		 * Get index by call identifier 
		 * @param callId Identifier of call 
		 * @return -1 - if call not found
		 **/		
		public function getIndexByCallId(callId:String):Number{
			for (var index:* in calls){
				var obj:* = calls.getItemAt(index);
				if (obj.id == callId){
					return index;
				}
			}
			return -1;
		}	
		
		/**
		 * @private
		 * Add call to calls collection
		 **/
		internal function addCall(call:Call):void{
			for (var index:* in calls){
				var obj:* = calls.getItemAt(index);
				if (obj.id == call.id){
					return;
				}
			}
			calls.addItem(call);
			for each (var apiNotify:APINotify in apiNotifys){
				apiNotify.notifyAddCall(call);
			}			
		}
		/**
		 * @private
		 * Remove call from calls collection
		 * @param callId Identifier of call
		 **/
		internal function removeCall(callId:String):void{
			for (var index:* in calls){
				var obj:* = calls.getItemAt(index);
				if (obj.id == callId){
					for each (var apiNotify:APINotify in apiNotifys){
						apiNotify.notifyRemoveCall(Call(obj));
					}					
					calls.removeItemAt(index);
				}
			}
		}
		
		/**
		 * Get controller of speaker
		 **/		
		public function getPhoneSpeaker():PhoneSpeaker{
			return this.phoneServerProxy.phoneSpeaker;
		}

		/**
		 * Add notifier to api
		 * @param apiNotify Object will be implemented APINotify
		 **/
		public function addAPINotify(apiNotify:APINotify):void{
			this.apiNotifys.addItem(apiNotify);
		}
		/**
		 * Get parameters from file 'flashphoner.xml'
		 **/
		public function getParameters():Object{
			var object:Object = PhoneModel.getInstance().parameters;
			if (object == null){
				return ErrorCodes.PARAMETERS_IS_NOT_INITIALIZED;				
			}else{
				return PhoneModel.getInstance().parameters;
			}
		}
		
		/**
		 * Get full version of server
		 **/
		public function getVersion():String{
			return PhoneConfig.getFullVersion();
		}
		
		/**
		 * Authentication on sip provider server on "flashphoner" mode
		 * @param username sip format username (example: sip:...)
		 * @param password Password for user
		 **/
		public function login(username:String,password:String,authenticationName:String = null):int{
			ExternalInterface.call("notifyRegisterRequired",PhoneConfig.REGISTER_REQUIRED);
			if (PhoneConfig.REGISTER_REQUIRED){
				upRegisteredTimer();
				startRegisterTimer();
			}
			videoControl.init();
			return phoneServerProxy.login(username,password,authenticationName);							
		}
		
		/**
		 * Authentication on sip provider server on "flashphoner" mode with token
		 * @param token Token for auth server
		 * @param password Password for user
		 **/		
		public function loginWithToken(token:String = null):void{
			ExternalInterface.call("notifyRegisterRequired",PhoneConfig.REGISTER_REQUIRED);
			if (PhoneConfig.REGISTER_REQUIRED){
				upRegisteredTimer();
				startRegisterTimer();
			}
			videoControl.init();
			phoneServerProxy.loginWithToken(token);
		}
		
		/**
		 * Create new call
		 * @param callee login of user - target call
		 * @param visibleName name of logged user wich target user see
		 * @param isVideoCall video call?(true/false)
		 **/ 
		public function call(callee:String, visibleName:String, isVideoCall:Boolean = true):int{
			if (PhoneConfig.CHECK_VALIDATION_CALLEE){
				var reg:RegExp = /[a-zа-яё]/i;
				if (callee != null && callee != ""){
						if ((callee.indexOf("sip:") == 0)){
							if (callee.indexOf("@") == -1 || callee.indexOf("@") == callee.length-1){
								return 1;
							}
						}else{
							if (callee.search(reg) != -1){
								if (callee.indexOf("@") != -1){
									return 1;
								}
								if (callee.indexOf(":") != -1){
									return 1;
								}
								callee = "sip:"+callee+"@"+modelLocator.sipProviderAddress+":"+modelLocator.sipProviderPort;
							}
						}
				}else{
					return 1;
				}
			}
			if (visibleName != null){
				visibleName.replace("\"","");
				visibleName.replace("'","");
			}
			for each (var tempCall:Call in calls){
				if (tempCall.state == Call.STATE_TALK){
					tempCall.setStatusHold(true);
				}
			}
			phoneServerProxy.call(visibleName,callee,isVideoCall);
			return 0;
		}
		
		/**
		 * Create new call by URL
		 * @param isVideoCall video call?(true/false)
		 **/ 		
		public function callByToken(token:String, isVideoCall:Boolean = true):int{
			phoneServerProxy.callByToken(token,isVideoCall);
			return 0;
		}
			
		/**
		 * Unhold all existed calls
		 **/ 
		public function unholdAnyCall():void{
			var call:Call;
			var hasTalkState:Boolean = false;
			for each (var tempCall:Call in calls){
				if (tempCall.state == Call.STATE_TALK){
					hasTalkState = true;
				}
				if (tempCall.state == Call.STATE_HOLD){
					call = tempCall;
				}
			}
			if (call != null && !hasTalkState){
				call.setStatusHold(false);
			}
		}
		
		/**
		 * Get information about logged user
		 **/
		public function getInfoAboutMe():ModelLocator{
			return modelLocator;
		}
		
		/**
		 * Get state of flash_api
		 * @return boolean of initialized state
		 **/
		public function isInitialized():Boolean{
			return PhoneModel.getInstance().initialized;
		}		
		
		/**
		 * Get volume of current microphone
		 * @return volume interval 1-100
		 **/
		public function getMicVolume():int{
			var mic:Microphone = soundControl.getMicrophone();
			if (mic == null){
				return 0;
			}else{
				return mic.gain;	
			}
			
		}
		
		/**
		 * Set volume for current microphone
		 * @param volume interval 1-100
		 **/
		public function setMicVolume(volume:int):void{
			var mic:Microphone = soundControl.getMicrophone();
			if (mic != null){
				mic.gain = volume;
			}
		}
		
		/**
		 * Get volume of speakers
		 * @return volume interval 1-100
		 **/
		public function getVolume():int{
			return phoneServerProxy.phoneSpeaker.getVolume();
		}
		
		/**
		 * Set volume for speakers
		 * @param volume interval 1-100
		 **/
		public function setVolume(volume:int):void{
			phoneServerProxy.phoneSpeaker.setVolume(volume);
		}
		
		/**
		 * Get list of microphones
		 **/
		public function getMicropones():Array{
			return Microphone.names;
		}
		
		/**
		 * Set current microphone
		 * @param name name of microphone
		 **/
		public function setMicrophone(name:String):void{
			var i:int = 0;
			for each (var nameMic:String in Microphone.names){
				if (nameMic == name){
					soundControl.changeMicrophone(i,false);
					return;						
				}
				i++;				
			}
		}
		
		/**
		 * Check access to the devices (mic,camera)
		 **/
		public function isMuted():int{
			return soundControl.isMuted();
		}
		
		/**
		 * Get list of cameras
		 **/
		public function getCameras():Array{
			return Camera.names;
		}
		
		/**
		 * Set current camera
		 * @param name name of camera
		 **/		
		public function setCamera(name:String):void{
			videoControl.changeCamera(Camera.getCamera(name));
		}
		
		/**
		 * Log off from the server and close connection
		 **/
		public  function logoff():void{
			phoneServerProxy.disconnect();
		}
		
		/**
		 * Get cookie from flash
		 * @param key Key of the parameter
		 **/
		public function getCookie(key:String):String{
			var localSharedObject:SharedObject = SharedObject.getLocal("Flashphoner");
			if (localSharedObject!=null){
				return localSharedObject.data[key];
			}
			return null;
		}
		
		/**
		 * Set cookie to flash
		 * @param key Key of the parameter
		 * @param value Value of the parameter
		 **/
		public function setCookie(key:String,value:String):void{
			var localSharedObject:SharedObject = SharedObject.getLocal("Flashphoner");
			if (localSharedObject!=null){
				localSharedObject.setProperty(key,value);
			}
		}
		
		/**
		 * @private
		 **/
		internal function startRegisterTimer():void{
			registeredTimer.start();	
		}
		
		
		/**
		 * @private
		 * Start timer for REGISTER_EXPIRE error
		 **/
		internal function upRegisteredTimer():void{
			if (registeredTimer!=null){
				registeredTimer.stop();
			} else {
				registeredTimer = new Timer(13000);
				registeredTimer.addEventListener(TimerEvent.TIMER,registeredExpire);					
			}
		}
		
		/**
		 * @private
		 * Stop timer for REGISTER_EXPIRE error 
		 **/
		internal function dropRegisteredTimer():void{
			if (registeredTimer!=null){
				registeredTimer.stop();
				registeredTimer.removeEventListener(TimerEvent.TIMER,registeredExpire);
				registeredTimer=null;
			}
		}
		
		/**
		 * Handler on registerTimer
		 **/
		private function registeredExpire(event:TimerEvent):void{
			for each (var apiNotify:APINotify in apiNotifys){
				apiNotify.notifyError(ErrorCodes.REGISTER_EXPIRE);
			}
			dropRegisteredTimer();			
		}			
		/**
		 * Impementation for Responder
		 **/  
		private function result(_call : Object) : void
		{
			var call:Call = new Call(this);
			call.id = _call.id;
			call.state = _call.state;
			call.incoming=false;
			call.anotherSideUser = _call.callee;
			addCall(call);
		}
		
		/**
		 * Send instance message to the user
		 * @param to target of the message
		 * @param body content of the message
		 * @param contentType type of content
		 **/
		public function sendMessage(to:String, body:String, contentType:String):void{
			var instantMessage:InstantMessage = new InstantMessage();
			instantMessage.body = body;
			instantMessage.to = to;
			instantMessage.contentType = contentType;
			this.phoneServerProxy.sendInstantMessage(instantMessage);
		}

		/**
		 * Send instance message to the user
		 * @param instantMessage 
		 **/		
		public function sendInstantMessage(instantMessage:InstantMessage):void{
			this.phoneServerProxy.sendInstantMessage(instantMessage);
		}
		

	}
}
