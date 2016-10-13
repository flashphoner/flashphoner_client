package 
{
	
	import flash.system.Capabilities;
	import flash.external.ExternalInterface;
	
	import mx.core.Application;
	import mx.core.FlexGlobals;

	public class Logger
	{	
		[Bindable]
		public static var log:String = new String();
		
		public function Logger()
		{
		}
		
		private static function getTime() : String
        {
            var dt : Date = new Date();
            var str : String = 'UTC ' + dt.getUTCMonth() + '.' + dt.getUTCDate() + ' ' + dt.getUTCHours() + ':' + dt.getUTCMinutes() + ':' + dt.getUTCSeconds() + ': ';
            return str;
        }

        public static function info(str : String) : void
        {           
                str = 'INFO:    ' + getTime() + str;
                traceLog(str);
                log += str + '\n';
            
        }

        public static function debug(str : String) : void
        {
           
                str = 'DEBUG:   ' + getTime() + str;
				traceLog(str);
                log += str + '\n';
          
        }

        public static function error(str : String) : void
        {
           
                str = 'ERROR:   ' + getTime() + str;
				traceLog(str);
                log += str + '\n';
           	
        } 
		
		public static function traceLog(str:String):void{
			//FlexGlobals.topLevelApplication.console.text = FlexGlobals.topLevelApplication.console.text + str +"\n";
			ExternalInterface.call("console.log", str);
		}

	
	}
}