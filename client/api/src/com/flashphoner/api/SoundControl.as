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
	
	import flash.display.FrameLabel;
	import flash.events.SampleDataEvent;
	import flash.events.TimerEvent;
	import flash.media.Microphone;
	import flash.media.MicrophoneEnhancedOptions;
	import flash.media.Sound;
	import flash.media.SoundChannel;
	import flash.media.SoundCodec;
	import flash.media.SoundTransform;
	import flash.net.URLRequest;
	import flash.system.Capabilities;
	import flash.utils.Timer;
	
	public class SoundControl
	{
		[Embed(source="/sounds/CALL_IN.mp3")]
		private static var ringInClass:Class;	
		[Embed(source="/sounds/CALL_OUT.mp3")]
		private static var ringOutClass:Class;		
		[Embed(source="/sounds/BUSY.mp3")]
		private static var busyClass:Class;
		[Embed(source="/sounds/REGISTER.mp3")]
		private static var registerClass:Class;
		[Embed(source="/sounds/HANGUP.mp3")]
		private static var finishClass:Class;
		
		private static var ringOutSound:Sound;
		private static var ringInSound:Sound;		
		private static var busySound:Sound;
		private static var registerSound:Sound;
		private static var finishSound:Sound;
		private static var ringSoundChannel:SoundChannel;
		
		/**
		 * Path to sound for ring
		 **/		
		public static var RING_OUT_SOUND:String = null;
		
		/**
		 * Path to sound for ring
		 **/		
		public static var RING_IN_SOUND:String = null;
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
		
		private var speexQuality:int = 6;
		
		private var agc:AGC;
		
		private static var DEFAULT_GAIN:Number=100;
		
		
		/**
		 * Control class (singelton) for microphone and sounds.
		 **/

		public function SoundControl(flash_API:Flash_API)
		{
			this.flash_API = flash_API;		

			Logger.info("Use enchenced mic: "+PhoneConfig.USE_ENHANCED_MIC);
			if (PhoneConfig.USE_ENHANCED_MIC){
				
				if (getMajorVersion() >= 11 || Capabilities.language.indexOf("en") >= 0){
					mic = Microphone.getEnhancedMicrophone();				
				}else{
					mic = Microphone.getMicrophone();
					for each (var apiNotify:APINotify in flash_API.apiNotifys){
						apiNotify.addLogMessage("WARNING!!! Echo cancellation is turned off on your side (because your OS has no-english localization). Please use a headset to avoid echo for your interlocutor.");
					}
				}
			}else{
				mic = Microphone.getMicrophone();
			}
			if (mic != null){
				initMic(mic,100,false);
			}
			
			agc = new AGC();
			
			updateSounds();
		}
		
		public function setSpeexQuality(quality:int):void{
			Logger.info("setSpeexQuality: "+quality);
			this.speexQuality = quality;
		}		
		
		/**
		 * Update all sounds from pathes
		 **/
	    public static function updateSounds():void{
			ringOutSound = Sound(new ringOutClass());
			ringInSound = Sound(new ringInClass());			
			busySound = Sound(new busyClass());
			registerSound = Sound(new registerClass());
			finishSound = Sound(new finishClass());	    
			
			if (SoundControl.RING_OUT_SOUND != null){
				ringOutSound = new Sound(new URLRequest(SoundControl.RING_OUT_SOUND));
			}
	    	if (SoundControl.RING_IN_SOUND != null){
				ringInSound = new Sound(new URLRequest(SoundControl.RING_IN_SOUND));
	    	}
	    	if (SoundControl.BUSY_SOUND != null){
				busySound = new Sound(new URLRequest(SoundControl.BUSY_SOUND));
	    	}
	    	if (SoundControl.REGISTER_SOUND != null){
				registerSound = new Sound(new URLRequest(SoundControl.REGISTER_SOUND));
	    	}
	    	if (SoundControl.FINISH_SOUND != null){
				finishSound = new Sound(new URLRequest(SoundControl.FINISH_SOUND));
	    	}
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
		public static function playInRingSound():void{
			Logger.info("playInRingSound");
			if (ringSoundChannel == null){
				ringSoundChannel = ringInSound.play(0,999);
			}			
		}
		
		/**
		 * Play register sound
		 **/		
		public static function playOutRingSound():void{
			Logger.info("playOutRingSound");
			if (ringSoundChannel == null){
				ringSoundChannel = ringOutSound.play(0,999);
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
			
			var microphone:Microphone;
			if (PhoneConfig.USE_ENHANCED_MIC){
				if (getMajorVersion() >= 11 || Capabilities.language.indexOf("en") >= 0){
					microphone = Microphone.getEnhancedMicrophone(index);
				}else{
					microphone = Microphone.getMicrophone(index);
				}
			}else{
				microphone = Microphone.getMicrophone(index);
			}
			

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
		
		private function initMic(mic:Microphone, gain:int=50, loopback:Boolean=true):void{
			var logMsg:String = "Init mic: codec: "+PhoneConfig.AUDIO_CODEC+" gain: "+50+" loopback: "+loopback;
			Logger.info(logMsg);
			for each (var apiNotify:APINotify in flash_API.apiNotifys){
				apiNotify.addLogMessage(logMsg);
			}	
			
			changeCodec(PhoneConfig.AUDIO_CODEC);
			
			if (gain != -1){
				mic.gain = gain;
				for each (var apiNotify:APINotify in flash_API.apiNotifys){
					apiNotify.notifyChangeMicVolume(mic.gain);
				}	
			}
			
			mic.soundTransform = new SoundTransform(1,0);			
			mic.setLoopBack(loopback);			
			mic.setSilenceLevel(0,3600000);
			mic.setUseEchoSuppression(true);
		}
		
		public function setMicVolume(volume:int):void {			
			if (volume==0){
				//mute
				agc.muted = true;
			}else{
				//unmute
				agc.muted = false;
			}
			if (mic != null){
				mic.gain = volume;
			}		
		}	
		
		public function enableAGC():void{
			Logger.info("enableAGC")
			mic.gain = DEFAULT_GAIN;
			if (PhoneConfig.USE_AUTO_GAIN_CONTROL){				
				if (!mic.hasEventListener(SampleDataEvent.SAMPLE_DATA)){
					mic.addEventListener(SampleDataEvent.SAMPLE_DATA, micSampleDataHandler);
				}
			}			
		}
		
		public function disableAGC():void{
			Logger.info("disableAGC");
			mic.gain = DEFAULT_GAIN;
			if (PhoneConfig.USE_AUTO_GAIN_CONTROL){				
				mic.removeEventListener(SampleDataEvent.SAMPLE_DATA, micSampleDataHandler);			
			}
		}
		
		private function micSampleDataHandler(event:SampleDataEvent):void {
			var result:AGCResult = agc.process(event.data,mic);
			if (agc.TRACE_AGC){
				if (result.hasResult){
					for each (var apiNotify:APINotify in flash_API.apiNotifys){
						apiNotify.notifyAgc(result.result);
					}
				}
			}
		}
		
		public function setAgcPolicy(policy:String):void{
			Logger.info("setAgcPolicy: "+policy);
			agc.setPolicy(policy);	
		}
		
		public function changeAudioCodec(codec:Object):void{			
			var localCodec:String = codec.localCodec;
			var remoteCodec:String = codec.remoteCodec;
			
			Logger.info("changeAudioCodec localCodec: "+localCodec+" remoteCodec: "+remoteCodec+" streamerTranscodingEnabled: "+codec.streamerTranscodingEnabled+" playerTranscodingEnabled: "+codec.playerTranscodingEnabled);
			changeCodec(localCodec);
			//if server-side transcoding is not enabled, use local client-side AGC
			if (!codec.streamerTranscodingEnabled){
				enableAGC();	
			}else{
			//if server-side transcoding is disabled, disable local client-side AGC, and use server-side AGC
				disableAGC();
			}
		}
		
		private function changeCodec(name:String):void{
			Logger.info("changeCodec: "+name);
			if (name=="speex"){
				mic.codec = SoundCodec.SPEEX;
				mic.framesPerPacket = 1;
				mic.rate = 16;
				mic.encodeQuality = speexQuality;				
			}else if (name=="ulaw" || name=="pcmu" ){
				mic.codec = SoundCodec.PCMU;
				mic.framesPerPacket = 2;
				mic.rate = 8;
			}else if (name=="alaw" || name=="pcma" ){
				mic.codec = SoundCodec.PCMA;
				mic.framesPerPacket = 2;
				mic.rate = 8;
			}
			Logger.info("codec: "+mic.codec+" framesPerPacket: "+mic.framesPerPacket+" encodeQuality: "+mic.encodeQuality+" rate: "+mic.rate);
		}
		
		private function getMajorVersion():Number{
			var flashPlayerVersion:String = Capabilities.version;
			
			var osArray:Array = flashPlayerVersion.split(' ');
			var osType:String = osArray[0];
			var versionArray:Array = osArray[1].split(',');
			return parseInt(versionArray[0]);
		}
		

	}
}
