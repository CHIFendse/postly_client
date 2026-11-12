package com.example.postlyforyakovlev.config;

import okhttp3.MediaType;

public final class ApiConfig {
    private ApiConfig(){}

    public static final String BASE_URL = "https://api.postly-mes.ru:8081";
    public static final MediaType JSON_MEDIA_TYPE = MediaType.get("application/json; charset=utf-8");
    public static final String WS_URL = "wss://api.postly-mes.ru:8081/ws";
}
