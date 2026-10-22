package com.example.postlyforyakovlev.services;

public interface AuthCallback {
    void onSuccess(String result);
    void onError(String errorMessage);
}
