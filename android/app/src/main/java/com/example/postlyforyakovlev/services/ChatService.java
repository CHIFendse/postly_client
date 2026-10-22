package com.example.postlyforyakovlev.services;

import com.google.gson.Gson;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;

public class ChatService {
    private final OkHttpClient client = new OkHttpClient();
    private final Gson gson = new Gson();
    private static String URL = "https://api.postly-mes.ru:8081";
    private static MediaType TYPE = MediaType.get("application/json; charset=utf-8");
}
