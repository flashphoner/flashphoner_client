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
	
	import flash.system.Capabilities; 
	public class Logger
	{	
		[Bindable]
		/**
		 * String which contain full logs.
		**/
		public static var log:String = new String();
		
		/**
		 * Default constructor
		**/
		public function Logger()
		{
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
                str = 'INFO:    ' + getTime() + str;
                trace(str);
                log += str + '';
            
        }

		/**
		 * Add debug message to log and output to trace
		 **/
        public static function debug(str : String) : void
        {
           
                str = 'DEBUG:   ' + getTime() + str;
                trace(str);
                log += str + '';
          
        }

		/**
		 * Add error message to log and output to trace
		 **/
        public static function error(str : String) : void
        {
           
                str = 'ERROR:   ' + getTime() + str;
                trace(str);
                log += str + '';
           
        }       

	
	}
}
