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
		 * Url to connect Wowza Media Server
		 **/
		public static var SERVER_URL:String = "rtmp://87.226.225.50:1935";
		
		/**
		 * Name of application in Wowza Media Server
		 **/
		public static var PHONE_APP_NAME:String ="phone_app";
		
		/**
		 * Name of application in Wowza Media Server
		 **/
		public static var C2C_APP_NAME:String ="c2c_app";

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
		public static var BUFFER_TIME:int = 0;
		
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
		 * Current version of Flashphoner client
		 **/
		public static var VERSION_OF_CLIENT:String = "1.0.X";

		/**
		 * Current version of Flashphoner server
		 **/		
		public static var VERSION_OF_SERVER:String = "1.0.5.X";
		
		public static var AUDIO_CODEC:String = "speex";
		
		/**
		 * Current version of Flashphoner product
		 **/		
		public static function getFullVersion():String{
			var client:String = VERSION_OF_CLIENT.substring(VERSION_OF_CLIENT.lastIndexOf(".")+1);
			var server:String = VERSION_OF_SERVER.substring(VERSION_OF_SERVER.lastIndexOf(".")+1);
			return client+"-"+server;
		}
		
		/**
		 * Resolutions which supported camera
		 **/
		public static var SUPPORTED_RESOLUTIONS:String ="";
		
	}
}
