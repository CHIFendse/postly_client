package com.example.postlyforyakovlev.data.local;

import android.content.Context;
import android.content.SharedPreferences;

public class SessionManager {
    private static final String PREF_NAME = "postly_session";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USERNAME = "username";

    private final SharedPreferences prefs;

    public SessionManager(Context context){
        this.prefs = context.getApplicationContext()
                .getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public void saveSession(String token, String userId, String username){
        prefs.edit()
                .putString(KEY_TOKEN, token)
                .putString(KEY_USER_ID, userId)
                .putString(KEY_USERNAME, username)
                .apply();
    }

    public String getToken(){
        return prefs.getString(KEY_TOKEN, null);
    }
    public String getUserId(){
        return prefs.getString(KEY_USER_ID, null);
    }
    public String getUsername(){
        return prefs.getString(KEY_USERNAME, null);
    }

    public boolean hasToken(){
        String token = getToken();
        return token != null && !token.trim().isEmpty();
    }

    public void clearSession(){
        prefs.edit().clear().apply();
    }
}
