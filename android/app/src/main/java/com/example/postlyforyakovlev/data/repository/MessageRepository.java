package com.example.postlyforyakovlev.data.repository;

import android.content.Context;

import androidx.annotation.NonNull;

import com.example.postlyforyakovlev.config.ApiConfig;
import com.example.postlyforyakovlev.data.dto.messages.MessageItem;
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
import okhttp3.HttpUrl;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

public class MessageRepository {
    private final Context appContext;
    private final Gson gson = new Gson();

    public MessageRepository(Context context) {
        this.appContext = context.getApplicationContext();
    }

    public void getMessages(String chatId, ApiCallback<List<MessageItem>> callback) {
        HttpUrl url = HttpUrl.parse(ApiConfig.BASE_URL + "/getMessages");
        if (url == null) {
            callback.onError("Неверный URL");
            return;
        }
        url = url.newBuilder().addQueryParameter("chat_id", chatId).build();
        execute(new Request.Builder().url(url).get().build(), callback);
    }

    // Старые сообщения: курсор = самое старое из уже загруженных
    public void getMoreMessages(String chatId, String lastMessageId, long lastCreatedAt,
                                ApiCallback<List<MessageItem>> callback) {
        JsonObject json = new JsonObject();
        json.addProperty("chat_id", chatId);
        json.addProperty("last_message_id", lastMessageId);
        json.addProperty("last_message_created_at", lastCreatedAt);

        RequestBody body = RequestBody.create(json.toString(), ApiConfig.JSON_MEDIA_TYPE);
        Request request = new Request.Builder()
                .url(ApiConfig.BASE_URL + "/getMoreMessages")
                .post(body)
                .build();
        execute(request, callback);
    }

    private void execute(Request request, ApiCallback<List<MessageItem>> callback) {
        ApiClient.get(appContext).newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                callback.onError("Нет соединения с сервером");
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) {
                try (Response r = response) {
                    if (!r.isSuccessful()) {
                        callback.onError(r.code() == 401
                                ? "Сессия истекла, войдите заново"
                                : "Ошибка сервера (" + r.code() + ")");
                        return;
                    }
                    ResponseBody body = r.body();
                    String json = body == null ? "" : body.string();
                    MessageItem[] arr = gson.fromJson(json, MessageItem[].class);
                    List<MessageItem> list = arr == null
                            ? new ArrayList<>() : Arrays.asList(arr);
                    callback.onSuccess(list);
                } catch (JsonSyntaxException e) {
                    callback.onError("Не удалось прочитать ответ сервера");
                } catch (IOException e) {
                    callback.onError("Ошибка чтения ответа");
                }
            }
        });
    }
}