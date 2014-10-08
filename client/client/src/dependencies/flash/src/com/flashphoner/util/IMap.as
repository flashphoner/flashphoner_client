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
package com.flashphoner.util
{
	import flash.utils.Dictionary;
	
	public interface IMap
	{
		function put(key:*, value:*) : void;
		
		function putAll(table:Dictionary) : void;
		
		function remove(key:*) : void;
		
		function containsKey(key:*) : Boolean;
		
		function containsValue(value:*) : Boolean;
		
		function getKey(value:*) : *;
		
		function getValue(key:*) : *;
		
		function getKeys() : Array;
		
		function getValues() : Array;
		
		function size() : int;
		
		function isEmpty() : Boolean;
		
		function reset() : void;
		
		function resetAllExcept(key:*) : void;
		
		function clear() : void;
		
		function clearAllExcept(key:*) : void;
	}
}
