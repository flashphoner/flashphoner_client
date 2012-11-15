package com.flashphoner.api
{
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.management.VideoControl;
	
	import flash.media.Camera;

	public class NullVideoControl extends VideoControl
	{
		public function NullVideoControl()
		{
			super();
		}
		
		public override function getCamera():Camera{
			return null;
		}
		
		/**
		 * Init width,height,fps and another parameters
		 **/ 
		public override function init():void{			
		}		
		
		/**
		 * Add new supported resolutions
		 **/
		public override function supportedResolutions(resolutions:String):void {			
			PhoneConfig.SUPPORTED_RESOLUTIONS = resolutions;			
		}
		
		/**
		 * Get current camera to used Flashphoner
		 **/
		public override function getCam():Camera{
			return null;
		}
		
		/**
		 * Change output format CIF/QCIF
		 **/
		public override function changeFormat(width:int, height:int):void{					
		}  		
		
		public override function changeCamera(camera:Camera):Camera{			
			return null;
		}
	}
}