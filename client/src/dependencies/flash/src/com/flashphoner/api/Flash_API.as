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
	import com.flashphoner.api.interfaces.APINotify;
	import com.flashphoner.api.js.APINotifyJS;
	import com.flashphoner.api.management.VideoControl;
	
	import flash.events.TimerEvent;
	import flash.external.ExternalInterface;
	import flash.media.Camera;
	import flash.media.Microphone;
	import flash.media.SoundCodec;
	import flash.media.SoundTransform;
	import flash.net.Responder;
	import flash.net.SharedObject;
	import flash.system.Capabilities;
	import flash.system.Security;
	import flash.utils.Timer;
	
	import mx.collections.ArrayCollection;

	[Bindable]
	public class Flash_API
	{
		/**
		 * @private
		 **/
		internal var phoneServerProxy:PhoneServerProxy;

		/**
		 * @private
		 * Notifier added by addNotify()
		 **/ 
		public static var apiNotifys:ArrayCollection;		
		/**
		 * Data about logged user
		 **/
		public var modelLocator:ModelLocator;
		
		/**
		 * Control of video
		 **/
		public var videoControl:VideoControl;
		
		private var mic:Microphone;

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
			Security.allowDomain("*");
			Logger.init();
			this.mic = defineMicrophone();
			apiNotifys = new ArrayCollection();
			addAPINotify(apiNotify);
			PhoneModel.getInstance();
			ExternalInterface.addCallback("logoff",logoff);
			ExternalInterface.addCallback("getMicVolume",getMicVolume);
			ExternalInterface.addCallback("setMicVolume",setMicVolume);
			ExternalInterface.addCallback("getVolume",getVolume);
			ExternalInterface.addCallback("setVolume",setVolume);
			ExternalInterface.addCallback("hasAccessToAudio",hasAccessToAudio);
			ExternalInterface.addCallback("hasAccessToVideo",hasAccessToVideo);
			ExternalInterface.addCallback("getMicropones",getMicropones);
			ExternalInterface.addCallback("setMicrophone",setMicrophone);
			ExternalInterface.addCallback("getCameras",getCameras);
			ExternalInterface.addCallback("setCamera",setCamera);
			ExternalInterface.addCallback("setSpeexQuality",setSpeexQuality);
			ExternalInterface.addCallback("openSettingsPanel",openSettingsPanel);
			modelLocator = new ModelLocator();
			phoneServerProxy = new PhoneServerProxy(this);
			
		}
		
		public function initMedia():void{
			Logger.info("Init media...");
			videoControl = new VideoControl();
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
			Flash_API.apiNotifys.addItem(apiNotify);
		}

		/**
		 * Get volume of current microphone
		 * @return volume interval 1-100
		 **/
		public function getMicVolume():int{
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
		
		public function getMicrophone():Microphone{
			return mic;
		}
		/**
		 * Set current microphone
		 * @param name name of microphone
		 **/
		public function setMicrophone(name:String):void{
			var i:int = 0;
			for each (var nameMic:String in Microphone.names){
				if (nameMic == name){
					var microphone:Microphone = defineMicrophone(i);
					if (microphone != null){
						this.mic = microphone;
						if (this.mic != null){	
							initMic(mic,-1,false);
						}
					}					
					return;						
				}
				i++;				
			}
		}
		
		/**
		 * Check access to the devices (mic,camera)
		 **/
		public function hasAccessToAudio():Boolean{
			if (mic == null){
				return true;
			}else{
				if (mic.muted){
					return false;
				}else{
					return true;
				}
				
			}
		}
		
		/**
		 * Check access to the devices (mic,camera)
		 **/
		public function hasAccessToVideo():Boolean{
			return videoControl.hasAccess();
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
		
		
		public function openSettingsPanel():void{
			Security.showSettings();
		}
		
		private function defineMicrophone(index:int=-1):Microphone {
			Logger.info("getMicrophone "+index);
			if (PhoneConfig.USE_ENHANCED_MIC){				
				if (PhoneConfig.MAJOR_PLAYER_VERSION >= 11 || Capabilities.language.indexOf("en") >= 0 || PhoneConfig.FORCE_ENHANCED_MIC){
					Logger.info("return EnhancedMicrophone");
					Logger.info("majorVersion: "+PhoneConfig.MAJOR_PLAYER_VERSION);
					Logger.info("Capabilities.language: "+Capabilities.language);
					Logger.info("FORCE_ENHANCED_MIC: "+PhoneConfig.FORCE_ENHANCED_MIC);
					return Microphone.getEnhancedMicrophone(index);				
				}else{					
					for each (var apiNotify:APINotify in Flash_API.apiNotifys){
						apiNotify.addLogMessage("WARNING!!! Echo cancellation is turned off on your side (because your OS has no-english localization). Please use a headset to avoid echo for your interlocutor.");
					}
					Logger.info("return Microphone");
					return Microphone.getMicrophone(index);
				}
			}else{
				Logger.info("return Microphone");
				return Microphone.getMicrophone(index);
			}
		}		
		
		private function initMic(mic:Microphone, gain:int=50, loopback:Boolean=false):void{
			var logMsg:String = "Init mic: codec: "+PhoneConfig.AUDIO_CODEC+" gain: "+50+" loopback: "+loopback;
			Logger.info(logMsg);
			for each (var apiNotify:APINotify in Flash_API.apiNotifys){
				apiNotify.addLogMessage(logMsg);
			}	
			
			changeCodec(PhoneConfig.AUDIO_CODEC);
			
			if (gain != -1){
				mic.gain = gain;
			}
			
			mic.soundTransform = new SoundTransform(1,0);			
			mic.setLoopBack(loopback);			
			mic.setSilenceLevel(0,3600000);
			mic.setUseEchoSuppression(true);
		}
		
		public function changeAudioCodec(codec:Object):void{			
			var codecName:String = codec.name;
			Logger.info("changeAudioCodec: "+codecName);
			changeCodec(codecName);
		}
		
		private function changeCodec(name:String):void{
			Logger.info("changeCodec: "+name);
			if (name=="speex"){
				mic.codec = SoundCodec.SPEEX;
				mic.framesPerPacket = 1;
				mic.rate = 16;
				mic.encodeQuality = 6;
			}else if (name=="ulaw" || name=="pcmu" ){
				mic.codec = SoundCodec.PCMU;
				mic.framesPerPacket = 2;
				mic.rate = 8;
			}else if (name=="alaw" || name=="pcma" ){
				mic.codec = SoundCodec.PCMA;
				mic.framesPerPacket = 2;
				mic.rate = 8;
			}
		}
		
		public function setSpeexQuality(quality:int){
			Logger.info("setSpeexQuality: "+quality);
			mic.encodeQuality=quality;
		}		
		
	}
}
