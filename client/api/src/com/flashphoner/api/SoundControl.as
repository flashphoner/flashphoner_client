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
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	
	import flash.events.Event;
	import flash.events.IOErrorEvent;
	import flash.events.ProgressEvent;
	import flash.media.Microphone;
	import flash.media.Sound;
	import flash.media.SoundChannel;
	import flash.media.SoundCodec;
	import flash.media.SoundTransform;
	import flash.net.URLRequest;
	import flash.system.Capabilities;
	
	import flashx.textLayout.events.UpdateCompleteEvent;
	
	public class SoundControl
	{
		
		[Embed(source="/sounds/CALL_OUT.mp3")]
		private static var ringClass:Class;		
		[Embed(source="/sounds/BUSY.mp3")]
		private static var busyClass:Class;
		[Embed(source="/sounds/REGISTER.mp3")]
		private static var registerClass:Class;
		[Embed(source="/sounds/HANGUP.mp3")]
		private static var finishClass:Class;

		private static var ringSound:Sound;		
		private static var busySound:Sound;
		private static var registerSound:Sound;
		private static var finishSound:Sound;
		private static var ringSoundChannel:SoundChannel;

		/**
		 * Path to sound for ring
		 **/		
		public static var RING_SOUND:String = null;
		/**
		 * Path to sound for busy
		 **/		
		public static var BUSY_SOUND:String = null;
		/**
		 * Path to sound for register event on voip server
		 **/		
		public static var REGISTER_SOUND:String = null;
		/**
		 * Path to sound for finish call
		 **/		
		public static var FINISH_SOUND:String = null;
				
		private static var soundControl:SoundControl;
		
		private var mic:Microphone;
		
		private var flash_API:Flash_API;
		
		private var majorPlayerVersion:Number=11;
		
		/**
		 * Control class (singelton) for microphone and sounds.
		 **/

		public function SoundControl(flash_API:Flash_API)
		{
			this.flash_API = flash_API;
			Logger.info("Use enchenced mic: "+PhoneConfig.USE_ENHANCED_MIC);		
			setFlashPlayerMajorVersion();
			mic = defineMicrophone();	
			
			if (mic != null){
				initMic(mic,50,false);
			}	
			
		}
		
		private function setFlashPlayerMajorVersion():void {
			Logger.info("setFlashPlayerMajorVersion");
			var flashPlayerVersion:String = Capabilities.version;			
			var osArray:Array = flashPlayerVersion.split(' ');
			var osType:String = osArray[0];
			var versionArray:Array = osArray[1].split(',');
			this.majorPlayerVersion = parseInt(versionArray[0]);
			Logger.info("majorVersion "+majorPlayerVersion);
		}
		
		private function defineMicrophone(index:int=-1):Microphone {
			Logger.info("getMicrophone "+index);
			if (PhoneConfig.USE_ENHANCED_MIC){				
				if (majorPlayerVersion >= 11 || Capabilities.language.indexOf("en") >= 0 || PhoneConfig.FORCE_ENHANCED_MIC){
					Logger.info("return EnhancedMicrophone");
					Logger.info("majorVersion: "+majorPlayerVersion);
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
		
		/**
		 * Update all sounds from pathes
		 **/
	    public static function updateSounds():void{
			ringSound = Sound(new ringClass());			
			busySound = Sound(new busyClass());
			registerSound = Sound(new registerClass());
			finishSound = Sound(new finishClass());	
			
			// Create new sounds. We will not check if links != 0, because we plus "" there. 
			// So it will not create error. Just will empty sounds.
			
			if (SoundControl.RING_SOUND!=null && SoundControl.RING_SOUND.length!=0){				
				updateSound(new Sound(new URLRequest(SoundControl.RING_SOUND)));
			}
						
			if (SoundControl.BUSY_SOUND!=null && SoundControl.BUSY_SOUND.length!=0){			
				updateSound(new Sound(new URLRequest(SoundControl.BUSY_SOUND)));
			}
			
			if (SoundControl.REGISTER_SOUND!=null && SoundControl.REGISTER_SOUND.length!=0){				
				updateSound(new Sound(new URLRequest(SoundControl.REGISTER_SOUND)));
			}
			
			if (SoundControl.FINISH_SOUND!=null && SoundControl.FINISH_SOUND.length!=0){				
				updateSound(new Sound(new URLRequest(SoundControl.FINISH_SOUND)));
			}
						 		
	    }
		
		private static function updateSound(sound:Sound):void{			
			sound.addEventListener(Event.COMPLETE, onUpdateSoundComplete);	
			sound.addEventListener(IOErrorEvent.IO_ERROR,onUpdateSoundError);
			Logger.info("updateSound: "+sound.url);
		}
		
		public static function onUpdateSoundError(event:IOErrorEvent):void{
			Logger.info("Error: "+event.text);	
		}
		
		// We are waiting for "complete" event. That mean if link broken and there is
		// no sound on that url, complete event will never appear.			
		// On complete event we are invoking assign function.
		// It assign old sounds to new ones.
		
		public static function onUpdateSoundComplete(event:Event):void{
			
			var localSound:Sound = event.target as Sound;
			
			// For every event we check by what sounds complete event was invoked.
			// we check sound url and compare it with all our urls.
			// When we found coincidence - we making assignment
			
			if (localSound.url.indexOf(SoundControl.RING_SOUND) >= 0){
				ringSound = localSound;				
			} 
			
			if (localSound.url.indexOf(SoundControl.BUSY_SOUND) >= 0) {
				busySound = localSound;
			} 	
			
			if (localSound.url.indexOf(SoundControl.REGISTER_SOUND) >= 0) {
				registerSound = localSound;
			} 
			
			if (localSound.url.indexOf(SoundControl.FINISH_SOUND) >= 0) {
				finishSound = localSound;
			}
			
			Logger.info("onUpdateSoundComplete :"+localSound.url);			
		} 

		/**
		 * Play busy sound
		 **/
		public static function playBusySound():void{
			busySound.play(0,1);			
		}

		/**
		 * Play finish sound
		 **/
		public static function playFinishSound():void{
			finishSound.play(0,1);		
		}
		
		/**
		 * Play register sound
		 **/
		public static function playRegisterSound():void{
			Logger.info("playRegisterSound "+registerSound.url);
			registerSound.play(0,1);		
		}			
		
		/**
		 * Stop ring sound
		 **/
		public static function stopRingSound():void{
			if (ringSoundChannel!=null){
				ringSoundChannel.stop();
				ringSoundChannel = null;
			}
		}
		
		/**
		 * Play register sound
		 **/		
		public static function playRingSound():void{
			if (ringSoundChannel == null){
				ringSoundChannel = ringSound.play(0,999);
			}			
		}
		
		public function isMuted():int{
			if (mic == null){
				return 0;
			}else{
				if (mic.muted){
					return 1;
				}else{
					return -1;
				}
				
			}
		}
		
		/**
		 * Change current microphone
		 * @param index of array
		 * @param isLoopBack playback voice on speakers
		 * @param gain volume of microphone(-1 - if not change volume)
		 **/
		public function changeMicrophone(index:int,isLoopback:Boolean,gain:Number = -1):void{
			Logger.info("changeMicrophone: index "+index+" isLoopback "+isLoopback+" gain: "+gain);
			var microphone:Microphone = defineMicrophone(index);
			if (microphone != null){
				this.mic = microphone;
				if (this.mic != null){	
					initMic(mic,gain,isLoopback);
				}
			}
		}
		
		/**
		 * Get cuurent microphone
		 **/
		public function getMicrophone():Microphone{
			return mic;
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
