package com.flashphoner.phone_app;
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

import com.flashphoner.sdk.media.Timing;
import com.flashphoner.sdk.rtmp.Config;
import com.flashphoner.sdk.rtmp.ConfigValidator;
import com.flashphoner.sdk.rtmp.IConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.util.List;
import java.util.Properties;

/**
 * Created by IntelliJ IDEA.
 * User: Andrew
 * Date: 15.11.11
 * Time: 18:05
 * To change this template use File | Settings | File Templates.
 */
public class ClientConfig implements IConfig {

    private static Logger log = LoggerFactory.getLogger(ClientConfig.class);

    /**
     * Internal properties object
     */
    private Properties props;

    /**
     * Singleton config instance
     */
    private static ClientConfig config;


    static {
        config = new ClientConfig();      
    }

    /**
     * Creates new config.<br/>
     * This constructor parses flashphoner.properties file and keeps parsed data.
     */
    private ClientConfig() {

        String wowzaHome = Config.WOWZA_HOME;
        props = new Properties();
        try {
            props.load(new FileInputStream(wowzaHome + "/conf/phone_app/flashphoner-client.properties"));
        } catch (Exception e) {
            log.error("Error flashphoner-client.properties init", e);
        }
    }

    /**
     * Retrieves flashphoner.properties as {@link java.util.Properties} object
     *
     * @return props
     */
    public Properties getProperties() {
        return props;
    }

    /**
     * Singleton model of config
     *
     * @return current config
     */
    public synchronized static ClientConfig getInstance() {
        return config;
    }

    /**
     * Retrieves property value by name
     *
     * @param propertyName
     * @return property value
     */
    public String getProperty(String propertyName) {
        return props.getProperty(propertyName);
    }

    /**
     * Sets property value for given key
     *
     * @param key
     * @param value
     */
    public void setProperty(String key, String value) {
        props.setProperty(key, value);
    }
}

