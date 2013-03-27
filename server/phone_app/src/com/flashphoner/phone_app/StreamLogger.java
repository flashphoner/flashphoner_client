/*
 * FLASHPHONER COMPANY CONFIDENTIAL
 * __________________________________________
 *
 * [2009] - [2011] Flashphoner company
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Flashphoner company and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Flashphoner company
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Flashphoner company.
 */

package com.flashphoner.phone_app;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Created by IntelliJ IDEA.
 * User: Alex
 * Date: Mar 27, 2013
 * Time: 6:22:32 PM
 * To change this template use File | Settings | File Templates.
 */
public class StreamLogger {

    private int interval;

    private static final Logger log = LoggerFactory.getLogger(StreamLogger.class);

    private Logger logger;

    private long count = 0;

    public static StreamLogger getLogger(String name) {
        return new StreamLogger(LoggerFactory.getLogger(name));
    }

    public StreamLogger(Logger logger) {
        this.logger = logger;
        try {
            interval = Integer.parseInt(ClientConfig.getInstance().getProperty("stream_log_interval"));
        } catch (Exception e) {
            interval = 100;
        }
        log.info("Create StreamLogger based on " + logger.getName() + " interval: " + interval);
    }

    public void log(String str) {
        if (count >= interval) {
            count = 0;
            logger.info(str);
        }
        count++;
    }

    public void trace(String str){
        log(str);
    }

    public void debug(String str){
        debug(str);
    }

    public boolean isTraceEnabled(){
        return logger.isTraceEnabled();
    }

    public boolean isDebugEnabled(){
        return logger.isDebugEnabled();
    }

}
