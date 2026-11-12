package com.example.postlyforyakovlev.data.repository;

import static com.example.postlyforyakovlev.config.ApiConfig.BASE_URL;
import static com.example.postlyforyakovlev.config.ApiConfig.JSON_MEDIA_TYPE;

import android.content.Context;
import android.os.Looper;
import android.os.Handler;

import androidx.annotation.NonNull;

import com.example.postlyforyakovlev.data.dto.login.LoginRequest;
import com.example.postlyforyakovlev.data.dto.login.LoginResponse;
import com.example.postlyforyakovlev.data.dto.registration.RegistrationRequest;
import com.example.postlyforyakovlev.data.dto.registration.RegistrationResponse;
import com.example.postlyforyakovlev.data.network.ApiCallback;
import com.example.postlyforyakovlev.data.network.ApiClient;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AuthRepository {
    private final OkHttpClient client;
    private final Gson gson = new Gson();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    public AuthRepository(Context context){
        this.client = ApiClient.get(context);
    }

    public void sendLoginRequest(String username, String password, ApiCallback<LoginResponse> callback){
        LoginRequest loginRequest = new LoginRequest(username, password);
        String jsonBody = gson.toJson(loginRequest);
        RequestBody requestBody = RequestBody.create(
                jsonBody,
                JSON_MEDIA_TYPE
        );

        Request request = new Request.Builder()
                .url(BASE_URL+"/login")
                .post(requestBody)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                mainHandler.post(() -> callback.onError("Ошибка сети: " + e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                try (Response res = response){
                    String bodyString = res.body() != null ? res.body().string() : "";
                    if (res.isSuccessful()){
                        LoginResponse loginResponse = gson.fromJson(bodyString, LoginResponse.class);
                        if (loginResponse != null && loginResponse.getToken() != null){
                            mainHandler.post(() -> callback.onSuccess(loginResponse));
                        } else {
                            mainHandler.post(() -> callback.onError("Сервер вернул пустой токен"));
                        }
                    } else {
                        String errorMsg = extractErrorMessage(bodyString, res.code());
                        mainHandler.post(() -> callback.onError(errorMsg));
                    }
                } catch (IOException | JsonSyntaxException exception){
                    mainHandler.post(() -> callback.onError("Ошибка чтения ответа " + exception.getMessage()));
                }
            }
        });
    }

    public void sendRegistrationRequest(RegistrationRequest registrationRequest, ApiCallback<RegistrationResponse> callback){
        String jsonBody = gson.toJson(registrationRequest);

        RequestBody requestBody = RequestBody.create(
                jsonBody,
                JSON_MEDIA_TYPE
        );

        Request request = new Request.Builder()
                .url(BASE_URL + "/register")
                .post(requestBody)
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                mainHandler.post(() -> callback.onError("Ошибка сети: " + e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                try (Response res = response){
                    String bodyString = res.body() != null ? res.body().string() : "";
                    if (res.isSuccessful()){
                        RegistrationResponse regResponse;
                        try{
                            regResponse = gson.fromJson(bodyString, RegistrationResponse.class);
                        } catch (JsonSyntaxException e){
                            regResponse = new RegistrationResponse("OK");
                        }
                        if (regResponse == null || regResponse.getStatus() == null){
                            regResponse = new RegistrationResponse("Регистрация прошла успешно, войдите в аккаунт");
                        }
                        final RegistrationResponse finalResponse = regResponse;
                        mainHandler.post(() -> callback.onSuccess(finalResponse));
                    } else {
                        String errorMsg = extractErrorMessage(bodyString, res.code());
                        mainHandler.post(() -> callback.onError(errorMsg));
                    }
                } catch (IOException e) {
                    mainHandler.post(() -> callback.onError("Ошибка чтения ответа: " + e.getMessage()));
                }
            }
        });
    }

    public void verifyToken(String token, ApiCallback<Boolean> callback){
        Request request = new Request.Builder()
                .url(BASE_URL + "/verify")
                .get()
                .addHeader("Authorization", "Bearer " + token)
                .addHeader("Content-Type", "application/json")
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                mainHandler.post(() -> callback.onError("Ошибка сети: " + e.getMessage()));
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                try (Response res = response){
                    boolean isValid = res.isSuccessful();
                    mainHandler.post(() -> callback.onSuccess(isValid));
                }
            }
        });
    }

    private String extractErrorMessage(String bodyString, int statusCode){
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
