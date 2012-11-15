package com.flashphoner.api
{
	import flash.media.Microphone;

	public class NullSoundControl extends SoundControl
	{
		public function NullSoundControl(flash_API:Flash_API){			 
			super(flash_API);
		}
		
		public override function changeAudioCodec(codec:Object):void{
		}	
		
		protected override function defineMicrophone(index:int=-1):Microphone{	
			return null;
		}
		
		public override function isMuted():int{
			return -1;
		}
		
		public override function changeMicrophone(index:int,isLoopback:Boolean,gain:Number = -1):void{		
		}
		
		public override function getMicrophone():Microphone{
			return null;
		}
		
		protected override function initMic(mic:Microphone, gain:int=50, loopback:Boolean=false):void{
		}
		
		protected override function changeCodec(name:String):void{
		}
		
		public override function setSpeexQuality(quality:int):void{
		}
		
		public override function setLoopBack(bool:Boolean):void{		
		}
		
	}
}