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
	import com.adobe.cairngorm.model.IModelLocator;
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.PhoneConfig;
	
	import flash.display.DisplayObjectContainer;
	import flash.events.*;
	import flash.external.ExternalInterface;
	import flash.media.*;
	import flash.net.*;
	import flash.utils.Timer;
	
	import mx.collections.ArrayCollection;
	import mx.core.Application;
	
	/**
	 * Model object
	 * **/	
	[Bindable]
	public class PhoneModel implements IModelLocator 
	{	
		private static var phoneModel:PhoneModel;
		
		public var initialized:Boolean = false;
		
		private var xml:XML;
		
		public var app : DisplayObjectContainer;
		private var phoneController:PhoneController;
		public var parameters:Object = null;		

		private static var initTimer:Timer;
				
		public static function getInstance():PhoneModel {
			if (phoneModel == null){
				phoneModel = new PhoneModel();
			}	
			return phoneModel;				
		}
				
		
		
		public function PhoneModel()
		{	
			super();
			startInitTimer();
			init();
			phoneController = new PhoneController();	
						
		}	
		
		private function init(event:TimerEvent = null):void{
			if (Application.application == null || Application.application.parameters == null){
				return;
			}else{
				dropInitTimer();
			}
			var loader:URLLoader = new URLLoader();
			var qwe:Object = Application.application.parameters;
			var config:String = "flashphoner.xml";
        	try{
				if (Application.application.parameters != null && Application.application.parameters.config!=null){
					config = Application.application.parameters.config;
				}
        	} catch (e:Error){
        		config = "flashphoner.xml";
        	}       			

			var request:URLRequest = new URLRequest(config);
			loader.load(request);
			loader.addEventListener(Event.COMPLETE, onComplete);
			loader.addEventListener(SecurityErrorEvent.SECURITY_ERROR,seurityErrorHandler);
			loader.addEventListener(IOErrorEvent.IO_ERROR,ioErrorHandler);
			
		}
		
		private function seurityErrorHandler(event:SecurityErrorEvent):void{
			throw new Error(event.toString());
		} 
		
		private function ioErrorHandler(event:IOErrorEvent):void{
			throw new Error(event.toString());
		}
		
		private function onComplete(event:Event):void
			{	
			    var loader:URLLoader = event.target as URLLoader;
			    if (loader != null)
			    {
			        xml = new XML(loader.data);
					var count:Number = xml.children().length();
					parameters = new Object();
					for (var i:Number = 0; i < count; i++)
					{
						var node:String =  xml.children()[i].localName().toString();
						parameters[node] = String(xml[node]); 
					}
			        
			        PhoneConfig.SERVER_URL = xml.rtmp_server;
			        PhoneConfig.APP_NAME = xml.application;
					var check_validation_callee:String = xml.check_validation_callee;
					PhoneConfig.CHECK_VALIDATION_CALLEE = (check_validation_callee == "true");
					
					var use_enhanced_mic:String = xml.use_enhanced_mic;
					PhoneConfig.USE_ENHANCED_MIC = (use_enhanced_mic == "true");
					
					var use_auto_gain_control:String = xml.use_auto_gain_control;
					PhoneConfig.USE_AUTO_GAIN_CONTROL = (use_auto_gain_control == "true");
					
			        var regRequired:String = xml.register_required; 
			        PhoneConfig.REGISTER_REQUIRED = (regRequired == "true");

					if (xml.video_width != null && xml.video_width.toString() != ""){
						PhoneConfig.VIDEO_WIDTH = int(xml.video_width);
					}
					if (xml.video_height != null && xml.video_height.toString() != ""){
						PhoneConfig.VIDEO_HEIGHT = int(xml.video_height);
					}
					if (xml.audio_codec != null && xml.audio_codec.toString() != ""){						
						PhoneConfig.AUDIO_CODEC = xml.audio_codec;
					}
					Logger.info("audio codec: "+PhoneConfig.AUDIO_CODEC);
					
					if (xml.ring_out_sound != null && xml.ring_out_sound.toString() != ""){
						Logger.info("RING_OUT_SOUND="+xml.ring_out_sound);
						SoundControl.RING_OUT_SOUND = xml.ring_out_sound;
					}					
			        if (xml.ring_in_sound != null && xml.ring_in_sound.toString() != ""){
						Logger.info("RING_IN_SOUND="+xml.ring_in_sound);
			        	SoundControl.RING_IN_SOUND = xml.ring_in_sound;
			        }
			        if (xml.busy_sound != null && xml.busy_sound.toString() != ""){
			        	SoundControl.BUSY_SOUND = xml.busy_sound;
			        }
			        if (xml.register_sound != null && xml.register_sound.toString() != ""){
				        SoundControl.REGISTER_SOUND = xml.register_sound;
			        }
			        if (xml.finish_sound != null && xml.finish_sound.toString() != ""){
				        SoundControl.FINISH_SOUND = xml.finish_sound;
			        }
					if (xml.dtmf_level!=null && xml.dtmf_level.toString()!=""){
						PhoneConfig.DTMF_LEVEL=Number(xml.dtmf_level);	
					}
					Logger.info("DTMF_LEVEL: "+PhoneConfig.DTMF_LEVEL);
					
					if (xml.security_allow_deny_remember!=null && xml.security_allow_deny_remember.length!=0){
						PhoneConfig.SECURITY_ALLOW_DENY_REMEMBER = (xml.security_allow_deny_remember == "true");
					}
					Logger.info("SECURITY_ALLOW_DENY_REMEMBER: "+PhoneConfig.SECURITY_ALLOW_DENY_REMEMBER);
					
			        SoundControl.updateSounds();
			    }
			    else
			    {
			        Logger.info("Can not load xml settings. Default settings will be used.");
			    }				
			    initialized = true;	
				
			} 

		
		public function dropInitTimer():void{
			if (initTimer!=null){
				initTimer.stop();
				initTimer.removeEventListener(TimerEvent.TIMER,init);
				initTimer=null;
			}
		}
		
		public function startInitTimer():void{
			if (initTimer!=null){
				initTimer.stop();
					
			} else {
				initTimer = new Timer(1000);
				initTimer.addEventListener(TimerEvent.TIMER,init);					
			}
			initTimer.start();	
		}		
		
	
	}
	
	
}
