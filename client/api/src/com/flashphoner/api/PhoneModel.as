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
	import com.flashphoner.api.interfaces.APINotify;
	import com.flashphoner.api.js.APINotifyJS;
	
	import flash.display.DisplayObjectContainer;
	import flash.events.*;
	import flash.external.ExternalInterface;
	import flash.media.*;
	import flash.net.*;
	import flash.system.Capabilities;
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
			
			setFlashPlayerMajorVersion();
			
		}
		
		private function setFlashPlayerMajorVersion():void {
			Logger.info("setFlashPlayerMajorVersion");
			var flashPlayerVersion:String = Capabilities.version;			
			var osArray:Array = flashPlayerVersion.split(' ');
			var osType:String = osArray[0];
			var versionArray:Array = osArray[1].split(',');
			PhoneConfig.MAJOR_PLAYER_VERSION = parseInt(versionArray[0]);
			Logger.info("majorVersion "+PhoneConfig.MAJOR_PLAYER_VERSION);
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
			        
					var wcs_server:String = xml.wcs_server;					
					if (wcs_server!=null && wcs_server.length!=0){
						PhoneConfig.WCS_SERVER = wcs_server;
					}
					Logger.info("WCS_SERVER: "+PhoneConfig.WCS_SERVER);
					
					var rtmfp_port:String = xml.rtmfp_port;					
					if (rtmfp_port!=null && rtmfp_port.length!=0){
						PhoneConfig.RTMFP_PORT = int(rtmfp_port);
					}
					Logger.info("RTMFP_PORT: "+PhoneConfig.RTMFP_PORT);
					
					var use_enhanced_mic:String = xml.use_enhanced_mic;
					
					if (use_enhanced_mic!=null && use_enhanced_mic.length!=0){
						PhoneConfig.USE_ENHANCED_MIC = (use_enhanced_mic == "true");
					}
					Logger.info("USE_ENHANCED_MIC: "+PhoneConfig.USE_ENHANCED_MIC);
					
					var forceEnhancedMic:String = xml.force_enhanced_mic;
					if (forceEnhancedMic!=null && forceEnhancedMic.length!=0){
						PhoneConfig.FORCE_ENHANCED_MIC= (forceEnhancedMic=="true");
					}
					Logger.info("FORCE_ENHANCED_MIC: "+PhoneConfig.FORCE_ENHANCED_MIC);
					
			        var regRequired:String = xml.register_required; 
			        PhoneConfig.REGISTER_REQUIRED = (regRequired == "true");

					if (xml.video_width != null && xml.video_width.toString() != ""){
						PhoneConfig.VIDEO_WIDTH = int(xml.video_width);
					}
					if (xml.video_height != null && xml.video_height.toString() != ""){
						PhoneConfig.VIDEO_HEIGHT = int(xml.video_height);
					}
					
					if (xml.keep_alive == "true"){
						PhoneConfig.KEEP_ALIVE=true;	
					}
					Logger.info("KEEP_ALIVE: "+PhoneConfig.KEEP_ALIVE);
					
					if (xml.keep_alive_interval !=null && xml.keep_alive_interval.toString() !=""){
						PhoneConfig.KEEP_ALIVE_INTERVAL = int(xml.keep_alive_interval);
					}
					Logger.info("KEEP_ALIVE_INTERVAL: "+PhoneConfig.KEEP_ALIVE_INTERVAL);
					
					if (xml.keep_alive_timeout !=null && xml.keep_alive_timeout.toString() !=""){
						PhoneConfig.KEEP_ALIVE_TIMEOUT = int(xml.keep_alive_timeout);
					}
					Logger.info("KEEP_ALIVE_TIMEOUT: "+PhoneConfig.KEEP_ALIVE_TIMEOUT);

                    if (xml.push_log != null && xml.push_log.toString() != ""){
                        PhoneConfig.PUSH_LOG = (xml.push_log == "true");
                    }
                    Logger.info("PUSH_LOG: "+PhoneConfig.PUSH_LOG);
					
					if (xml.audio_codec != null && xml.audio_codec.toString() != ""){						
						PhoneConfig.AUDIO_CODEC = xml.audio_codec;
					}
					Logger.info("AUDIO_CODEC: "+PhoneConfig.AUDIO_CODEC);
					
					if (xml.avoid_flv2h264_transcoding != null && xml.avoid_flv2h264_transcoding.toString() != ""){
						PhoneConfig.AVOID_FLV2H264_TRANSCODING = (xml.avoid_flv2h264_transcoding == "true");
					}
					Logger.info("AVOID_H264_TRANSCODING: "+PhoneConfig.AVOID_FLV2H264_TRANSCODING);
					
					if (xml.audio_reliable != null && xml.audio_reliable.toString() != ""){
						PhoneConfig.AUDIO_RELIABLE = (xml.audio_reliable == "true");
					}
					Logger.info("AUDIO_RELIABLE: "+PhoneConfig.AUDIO_RELIABLE);
					
					if (xml.video_reliable != null && xml.video_reliable.toString() != ""){
						PhoneConfig.VIDEO_RELIABLE = (xml.video_reliable == "true");
					}
					Logger.info("VIDEO_RELIABLE: "+PhoneConfig.VIDEO_RELIABLE);
					
					if (xml.buffer_time != null && xml.buffer_time.toString() != ""){
						PhoneConfig.BUFFER_TIME = Number(xml.buffer_time);
					}
					Logger.info("BUFFER_TIME: "+PhoneConfig.BUFFER_TIME);
					
			        if (xml.ring_sound != null && xml.ring_sound.toString() != ""){
			        	SoundControl.RING_SOUND = xml.ring_sound;
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
					
					if (xml.load_balancer_url != null && xml.load_balancer_url.toString() !=""){
			            PhoneConfig.LOAD_BALANCER_URL = xml.load_balancer_url;
					}
					
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
