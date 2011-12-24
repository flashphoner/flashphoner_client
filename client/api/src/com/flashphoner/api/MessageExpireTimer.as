package com.flashphoner.api
{
	import flash.utils.Timer;

	public class MessageExpireTimer extends Timer
	{
		public var message:InstantMessage;
		
		public function MessageExpireTimer(msg:InstantMessage,delay:Number,period:Number)
		{
			super(delay,period);
			this.message = msg;
		}		
		
	}
}