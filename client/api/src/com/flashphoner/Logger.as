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
package com.flashphoner
{
	
	import com.flashphoner.api.data.PhoneConfig;
	
	import flash.system.Capabilities;

	public class Logger
	{	
		[Bindable]
		/**
		 * String which contain full logs.
		**/
		public static var log:String = new String();				
		
		public static var SEVERITY:Object = new Object();
		
		public static var SEVERITY_VALUE:int = 30;
		
		/**
		 * Default constructor
		**/
		public static function init():void
		{	
			SEVERITY["ERROR"]=10;
			SEVERITY["WARN"]=20;
			SEVERITY["INFO"]=30;
			SEVERITY["DEBUG"]=40;
			SEVERITY["TRACE"]=50;
			SEVERITY_VALUE = SEVERITY[PhoneConfig.LOG_SEVERITY];
			trace("Init logger, SEVERITY: "+PhoneConfig.LOG_SEVERITY+" "+SEVERITY_VALUE);
		}
		
		private static function getTime() : String
        {
            var dt : Date = new Date();
            var str : String = 'UTC ' + dt.getUTCMonth() + '.' + dt.getUTCDate() + ' ' + dt.getUTCHours() + ':' + dt.getUTCMinutes() + ':' + dt.getUTCSeconds() + ': ';
            return str;
        }

		/**
		 * Add info message to log and output to trace
		 **/
        public static function info(str : String) : void
        {       
			_log(str,"INFO");            
        }

		/**
		 * Add debug message to log and output to trace
		 **/
        public static function debug(str : String) : void
        {
			_log(str,"DEBUG");          
        }

		/**
		 * Add error message to log and output to trace
		 **/
        public static function error(str : String) : void
        {
			_log(str,"ERROR");           
        }     
		
		public static function warn(str : String) : void
		{
			_log(str,"WARN");
			
		}
		
		public static function _trace(str : String) : void
		{
			_log(str,"TRACE");
			
		} 
		
		private static function _log(str:String,severity:String):void{
			if (SEVERITY[severity] <= SEVERITY_VALUE ){
				str = severity+':   ' + getTime() + str;
				trace(str);
				log += str + '';
			}
		}

	
	}
}
