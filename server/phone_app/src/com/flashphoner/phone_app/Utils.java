package com.flashphoner.phone_app;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Created with IntelliJ IDEA.
 * User: Alexey
 * Date: 10.02.14
 * Time: 19:14
 * To change this template use File | Settings | File Templates.
 */
public class Utils {

    private static Logger log = LoggerFactory.getLogger(Utils.class);

    static Map<String, String> parseStreamMap(String str) {
        Map<String, String> streamMap = new HashMap<String, String>();
        //stream_map = stream1,login1;stream2,login2
        String[] entries = str.trim().split(";");
        for (String entry : entries) {
            String[] nameValue = entry.trim().split(",");
            streamMap.put(nameValue[0].trim(), nameValue[1].trim());
        }
        log.info("parsed streamMap: " + streamMap);

        return streamMap;
    }
}
