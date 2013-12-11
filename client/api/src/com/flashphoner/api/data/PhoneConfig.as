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
package com.flashphoner.api.data
{	
	import flash.events.*;
	import flash.net.*;
	[Bindable]
	/**
	 * Confiruration parameters from file flashphoner.xml
	 **/
	public class PhoneConfig
	{
		/**
		 * Width of outgoing video
		 **/
		public static var VIDEO_WIDTH:int = 176;		

		/**
		 * Height of outgoing video
		 **/
		public static var VIDEO_HEIGHT:int = 144;
		
		/**
		 * Size of buffer in incomming video
		 **/
		public static var BUFFER_TIME:Number = 0;
		
		/**
		 * Is User Agent on VoIP server required (true/false)
		 **/
		public static var REGISTER_REQUIRED:Boolean = true;
		
		/**
		 * Is videocalls support enabled (true/false)
		 **/	
		public static var VIDEO_ENABLED:Boolean = true;	
		
		/**
		 * Is callee validation enabled (true/false) 
		 **/
		public static var CHECK_VALIDATION_CALLEE:Boolean = true;
		
		/**
		 * Is use enhansed mic for echo supression (true/false) 
		 **/
		public static var USE_ENHANCED_MIC:Boolean = true;
		
		/**
		 * Always use enhanced mic, regardless of Player version or locale
		 **/
		public static var FORCE_ENHANCED_MIC:Boolean = false;
	
		/**
		 * Current version of Flashphoner client
		 **/
		public static var VERSION_OF_CLIENT:String = "1.0.X";

		/**
		 * Current version of Flashphoner server
		 **/		
		public static var VERSION_OF_SERVER:String = "1.0.5.X";
		
		public static var AUDIO_CODEC:String = "speex";
		
		public static var KEEP_ALIVE:Boolean = false;
		
		public static var KEEP_ALIVE_INTERVAL:int = 1000;
		
		public static var KEEP_ALIVE_TIMEOUT:int = 5000;
		
		public static var PUSH_LOG:Boolean = false;
		
		public static var LOG_SEVERITY:String = "INFO";
		
		public static var MAJOR_PLAYER_VERSION:int = 11;
		
		public static var AVOID_FLV2H264_TRANSCODING:Boolean = true;
		
		public static var VIDEO_RELIABLE = false;
		
		public static var AUDIO_RELIABLE = false;
		
		public static var LOAD_BALANCER_URL = null;
		
		public static var WCS_SERVER:String = "192.168.1.5";
		
		public static var RTMFP_PORT:int = 1935;
		
		/**
		 * Current version of Flashphoner product
		 **/		
		public static function getFullVersion():String{
			var client:String = "X";
			var indexClient:int = VERSION_OF_CLIENT.lastIndexOf(".");
			if (indexClient > -1){
				client = VERSION_OF_CLIENT.substring(indexClient+1);
			}
	
			var indexServer:int = VERSION_OF_SERVER.lastIndexOf(".")
			var server:String = "X";
			if (indexServer > -1){
				server = VERSION_OF_SERVER.substring(indexServer+1);
			} 
			return client+"-"+server;
		}
		
		public static function getRandomInt(from:int, to:int):int{
			return int(Math.floor( from + ( Math.random() * ( to - from + 1))));
		}
		
		/**
		 * Resolutions which supported camera
		 **/
		public static var SUPPORTED_RESOLUTIONS:String ="";
		
	}
}
