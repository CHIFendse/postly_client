package com.example.postlyforyakovlev.services;

import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import com.example.postlyforyakovlev.dto.login.LoginRequest;
import com.example.postlyforyakovlev.dto.login.LoginResponse;
import com.example.postlyforyakovlev.dto.registration.RegistrationRequest;
import com.google.gson.Gson;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AuthService {
    private final OkHttpClient client = new OkHttpClient();
    private final Gson gson = new Gson();
    private static String URL = "https://api.postly-mes.ru:8081";

    private static MediaType TYPE = MediaType.get("application/json; charset=utf-8");

    public void sendLoginRequest(String username, String password, AuthCallback callback){
        LoginRequest loginRequest = new LoginRequest(username, password);
        String jsonBody = gson.toJson(loginRequest);
        RequestBody requestBody = RequestBody.create(
                jsonBody,
                TYPE
        );

        Request request = new Request.Builder()
                .url(URL+"/login")
                .post(requestBody)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Handler mainHandler =new Handler(Looper.getMainLooper());
                mainHandler.post(() -> callback.onError("Ошибка сети: " + e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                LoginResponse loginResponse = mapToLoginResponse(response);
                Handler mainHandler = new Handler(Looper.getMainLooper());

                mainHandler.post(() -> {
                    if (response.isSuccessful()) {
                        callback.onSuccess(loginResponse.toString());
                    } else {
                        callback.onError("Ошибка сервера " + response.code());
                    }
                });
            }
        });
    }

    public void sendRegistrationRequest(RegistrationRequest registrationRequest, AuthCallback callback){
        String jsonBody = gson.toJson(registrationRequest);

        RequestBody requestBody = RequestBody.create(
                jsonBody,
                TYPE
        );

        Request request = new Request.Builder()
                .post(requestBody)
                .url(URL + "/register")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Handler mainHandler = new Handler(Looper.getMainLooper());
                mainHandler.post(() -> callback.onError("Ошибка сети: " + e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                String status = mapToRegistrationRequest(response);
                Handler mainHandler = new Handler(Looper.getMainLooper());

                mainHandler.post(() -> {
                    if (response.isSuccessful()) {
                        callback.onSuccess(status);
                    } else {
                        callback.onError("Ошибка сервера " + response.code());
                    }
                });
            }
        });
    }

    private LoginResponse mapToLoginResponse(Response response) throws IOException {
        String bodyString = response.body() != null ? response.body().string() : "";
        return new Gson().fromJson(bodyString, LoginResponse.class);
    }

    private String mapToRegistrationRequest(Response response){
        String bodyString = response.body() != null ? response.body().toString() : "";
        return new Gson().fromJson(bodyString, String.class);
    }
}
