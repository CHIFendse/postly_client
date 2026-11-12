package com.example.postlyforyakovlev.data.network;

public interface ApiCallback<T> {
    void onSuccess(T result);
    void onError(String errorMessage);
}
