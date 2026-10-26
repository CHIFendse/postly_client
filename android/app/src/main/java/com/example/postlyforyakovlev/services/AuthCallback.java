package com.example.postlyforyakovlev.services;

public interface AuthCallback<T> {
    void onSuccess(T result);
    void onError(String errorMessage);
}
