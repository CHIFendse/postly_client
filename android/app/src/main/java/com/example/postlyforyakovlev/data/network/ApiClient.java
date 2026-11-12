package com.example.postlyforyakovlev.data.network;

import android.content.Context;

import com.example.postlyforyakovlev.data.local.SessionManager;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;

public final class ApiClient {
    private static OkHttpClient client;

    private ApiClient(){}

    public static synchronized OkHttpClient get(Context context){
        if (client==null){
            SessionManager session = new SessionManager(context.getApplicationContext());

            client = new OkHttpClient.Builder()
                    .connectTimeout(10, TimeUnit.SECONDS)
                    .readTimeout(15, TimeUnit.SECONDS)
                    .addInterceptor(chain -> {
                        Request original = chain.request();
                        String token = session.getToken();

                        if (token == null || token.isEmpty() || original.header("Authorization") != null){
                            return chain.proceed(original);
                        }

                        Request withAuth = original.newBuilder()
                                .header("Authorization", "Bearer " + token)
                                .build();
                        return chain.proceed(withAuth);
                    }).build();
        }
        return client;
    }
}
