package com.example.postlyforyakovlev.data.repository;

import static com.example.postlyforyakovlev.config.ApiConfig.extractErrorMessage;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.example.postlyforyakovlev.config.ApiConfig;
import com.example.postlyforyakovlev.data.dto.chat.ChatItem;
import com.example.postlyforyakovlev.data.dto.init.InitClientResponse;
import com.example.postlyforyakovlev.data.network.ApiCallback;
import com.example.postlyforyakovlev.data.network.ApiClient;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class ChatListRepository {
    private final OkHttpClient client;
    private final Gson gson = new Gson();
    private final Handler handler = new Handler(Looper.getMainLooper());

    public ChatListRepository(Context context) {
        this.client = ApiClient.get(context);
    }

    public void getChats(ApiCallback<List<ChatItem>> callback) {
        Request request = new Request.Builder()
                .url(ApiConfig.BASE_URL + "/init_client")
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                handler.post(() -> callback.onError("Ошибка сети"));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                try (Response res = response) {
                    String bodyString = res.body() != null ? res.body().string() : "";
                    InitClientResponse clientResponse = gson.fromJson(bodyString, InitClientResponse.class);
                    if (res.isSuccessful()) {
                        handler.post(() -> callback.onSuccess(clientResponse.getChats()));
                    } else {
                        String errorMessage = extractErrorMessage(bodyString, res.code(), gson);
                        handler.post(() -> callback.onError(errorMessage));
                    }
                } catch (IOException e) {
                    handler.post(() -> callback.onError("Пизда рулям"));
                }
            }
        });
    }
}