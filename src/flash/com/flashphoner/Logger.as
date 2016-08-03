package com.flashphoner {

	import com.flashphoner.api2.Main;

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
		}
		
		private static function getTime() : String
        {
            var dt : Date = new Date();
            var str : String = 'UTC ' + dt.getUTCMonth() + '.' + dt.getUTCDate() + ' ' + dt.getUTCHours() + ':' + dt.getUTCMinutes() + ':' + dt.getUTCSeconds() + '.' + dt.getUTCMilliseconds() + ': ';
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
				str = severity+':   ' + getTime() + str + "\n";
				trace(str);
				Main.addLogMessage(str);
				log += str + '';
			}
		}
		
		public static function clear():void {
			log = new String();
		}
		
		//merge two logs together based on time
		public static function merge(logsJS:String):String {
			//split logs to Arrays of Strings
			var logsJSArray:Array = logsJS.split("\n");
			var logArray:Array = log.split("\n");
			
			//create time pattern
			var timePattern:RegExp = /[0-9]*:[0-9]*:[0-9]*\.[0-9]*/;
			
			//create new array and fill it with data
			var resultingArray:Array = new Array();
			
			var result:Array = new Array();
			var s:String;

			for each (s in logsJSArray) {
				result = s.match(timePattern);
				if (result != null) {
					resultingArray.push([logTimeToInt(result[0]) , "[JS]\t" + s]);
				}
			}

			for each (s in logArray) {
				result = s.match(timePattern);
				if (result != null) {
					resultingArray.push([logTimeToInt(result[0]), "[FLASH]\t" + s]);
				}
			}
			
			//sort array based on time
			resultingArray.sortOn("0");
			
			var resultingLogs:String = new String();
			var i:Array;
			for each (i in resultingArray) {
				resultingLogs += i[1] + "\n";
			}
			
			return resultingLogs;
		}
		
		private static function logTimeToInt(s:String):int {
			s = s.replace(/:/g, "");
			
			var ms:String = s.substr(s.indexOf("."));
			var replaceStr:String = new String("");
			if(ms.length == 2) {
				replaceStr = "00";
			} else if (ms.length == 3) {
				replaceStr = "0";
			}
			
			s = s.replace(/\./, replaceStr);
			var result:int = int(s);
			return result;
		}


	
	}
}
