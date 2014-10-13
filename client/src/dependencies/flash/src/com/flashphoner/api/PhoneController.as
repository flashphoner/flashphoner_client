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
	import com.adobe.cairngorm.control.FrontController;
	
	/**
	 * Dispatcher for all application events
	 * **/	
	internal class PhoneController extends FrontController 
	{	
		private static var UUID : String = "33de0550-44d6-4550-b133-43344716776a";
		
		public function PhoneController()
		{
			init();
		} 

		private function init(): void
		{	
			addCommand(MainEvent.AUDIO_CODEC_CHANGED_EVENT,MainCommand);
			addCommand(MainEvent.VIDEO_FORMAT_CHANGED,MainCommand);
		}
	}
}
