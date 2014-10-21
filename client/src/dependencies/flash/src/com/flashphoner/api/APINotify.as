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
	import flash.external.ExternalInterface;
	
	/**
	 * Implementaion interface for js-phones
	 **/
	public class APINotify
	{
		public function APINotify()
		{
		}
		public function notifyCloseConnection():void{
			ExternalInterface.call("notifyCloseConnection");
		}
		public function addLogMessage(message:String):void{
			ExternalInterface.call("addLogMessage", message);
		}
	}
}
