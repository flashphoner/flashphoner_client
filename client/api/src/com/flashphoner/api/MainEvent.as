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
	import com.adobe.cairngorm.control.CairngormEvent;
	
	import flash.events.Event;
	
	/**
	 * Phone event - describe all phone events
	 * **/
	internal class MainEvent extends CairngormEvent
	{	
		public static const CONNECTED:String = "CONNECTED";
		public static const REGISTERED:String = "REGISTERED";
		public static const DISCONNECT:String = "DISCONNECT";
		public static const MESSAGE_ACCEPTED:String = "MESSAGE_ACCEPTED";
		public static const VIDEO_FORMAT_CHANGED:String = "VIDEO_FORMAT_CHANGED";
		public static const AUDIO_CODEC_CHANGED_EVENT:String = "AUDIO_CODEC_CHANGED_EVENT";
		
		public var flashAPI:Flash_API;
		public var obj:Object;
		
		public function MainEvent(type:String, flashAPI:Flash_API):void
		{
			super(type);
			this.flashAPI = flashAPI;		
		}
		
	}
}
