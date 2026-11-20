package com.example.postlyforyakovlev.ui.start;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.example.postlyforyakovlev.data.repository.AuthRepository;
import com.example.postlyforyakovlev.data.local.SessionManager;
import com.example.postlyforyakovlev.data.network.ApiCallback;

public class StartupViewModel extends AndroidViewModel {
    public enum Destination {LOADING, CHAT_LIST, LOGIN}

    private final MutableLiveData<Destination> destination = new MutableLiveData<>(Destination.LOADING);
    private final AuthRepository authRepository = new AuthRepository(this.getApplication());

    public StartupViewModel(@NonNull Application application) {
        super(application);
        SessionManager session = new SessionManager(application);

        if (!session.hasToken()){
            destination.setValue(Destination.LOGIN);
            return;
        }

        authRepository.verifyToken(session.getToken(), new ApiCallback<Boolean>() {
            @Override
            public void onSuccess(Boolean isValid) {
                if (Boolean.TRUE.equals(isValid)){
                    destination.postValue(Destination.CHAT_LIST);
                } else {
                    session.clearSession();
                    destination.postValue(Destination.LOGIN);
                }
            }

            @Override
            public void onError(String errorMessage) {
                destination.postValue(Destination.CHAT_LIST);
            }
        });
    }

    public LiveData<Destination> getDestination() {
        return destination;
    }
}
