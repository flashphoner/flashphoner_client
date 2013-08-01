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
	 * Message event - describe all phone events
	 * **/
	internal class MessageEvent extends CairngormEvent
	{	
		public static const MESSAGE_EVENT:String = "MESSAGE_EVENT";		
		
		public var flashAPI:Flash_API;	
		public var messageObj:Object;	
		public var notificationResult:Object;
		public var sipObject:Object;
		
		public function MessageEvent(type:String,messageObj:Object, flashAPI:Flash_API ):void
		{
			super(type,bubbles,cancelable);
			this.messageObj = messageObj;	
			this.flashAPI = flashAPI;
		}
		
	}
}
