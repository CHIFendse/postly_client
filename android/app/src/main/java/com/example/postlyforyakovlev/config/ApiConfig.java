package com.example.postlyforyakovlev.config;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;

import okhttp3.MediaType;

public final class ApiConfig {
    private ApiConfig(){}

    public static final String BASE_URL = "https://api.postly-mes.ru:8081";
    public static final MediaType JSON_MEDIA_TYPE = MediaType.get("application/json; charset=utf-8");
    public static final String WS_URL = "wss://api.postly-mes.ru:8081/ws";

    public static String extractErrorMessage(String bodyString, int statusCode, Gson gson){
        if (bodyString != null && !bodyString.isEmpty()){
            try {
                JsonObject jsonObject = gson.fromJson(bodyString, JsonObject.class);
                if (jsonObject != null && jsonObject.has("message") && !jsonObject.get("message").isJsonNull()){
                    return jsonObject.get("message").getAsString();
                }
            } catch (JsonSyntaxException ignored) {
            }
        }
        return "Ошибка сервера (" + statusCode + ")";
    }
}
