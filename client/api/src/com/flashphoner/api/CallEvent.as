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
	internal class CallEvent extends CairngormEvent
	{	
		public static const IN:String = "IN";
		public static const OUT:String = "OUT";
		public static const TALK:String = "TALK";
		public static const HOLD:String = "HOLD";
		public static const BUSY:String = "BUSY";
		public static const FINISH:String = "FINISH";
		public static const SESSION_PROGRESS:String = "SESSION_PROGRESS";
		
		public var call:Call;	
				
		public function CallEvent(type:String,call:Call):void
		{
			super(type,bubbles,cancelable);
			this.call = call;		
		}
		
	}
}
