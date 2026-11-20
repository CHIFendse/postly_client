package com.example.postlyforyakovlev.ui.chat;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.example.postlyforyakovlev.data.dto.messages.MessageItem;
import com.example.postlyforyakovlev.data.network.ApiCallback;
import com.example.postlyforyakovlev.data.repository.MessageRepository;

import java.util.ArrayList;
import java.util.List;

public class MessageViewModel extends AndroidViewModel {
    private final MessageRepository repository;
    private final MutableLiveData<List<MessageItem>> messages = new MutableLiveData<>();
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);

    private String chatId;
    private boolean loadingMore = false;
    private boolean allLoaded = false;

    public MessageViewModel(@NonNull Application application) {
        super(application);
        repository = new MessageRepository(application);
    }

    public LiveData<List<MessageItem>> getMessages() { return messages; }
    public LiveData<String> getError() { return error; }
    public LiveData<Boolean> getLoading() { return loading; }

    public void load(String chatId) {
        if (chatId == null || chatId.equals(this.chatId)) return;
        this.chatId = chatId;
        allLoaded = false;
        loading.setValue(true);
        repository.getMessages(chatId, new ApiCallback<List<MessageItem>>() {
            @Override
            public void onSuccess(List<MessageItem> result) {
                messages.postValue(result);
                loading.postValue(false);
            }

            @Override
            public void onError(String errorMessage) {
                error.postValue(errorMessage);
                loading.postValue(false);
                ViewModelReset();
            }
        });
    }

    private void ViewModelReset() {
        chatId = null; // чтобы можно было повторить
    }

    // Вызывается, когда пользователь долистал до самых старых загруженных сообщений
    public void loadMore() {
        List<MessageItem> current = messages.getValue();
        if (chatId == null || loadingMore || allLoaded
                || current == null || current.isEmpty()) return;

        loadingMore = true;
        MessageItem oldest = current.get(current.size() - 1); // список newest-first
        repository.getMoreMessages(chatId, oldest.getId(), oldest.getCreatedAt(),
                new ApiCallback<List<MessageItem>>() {
                    @Override
                    public void onSuccess(List<MessageItem> older) {
                        if (older.isEmpty()) {
                            allLoaded = true;
                        } else {
                            List<MessageItem> merged = new ArrayList<>(current);
                            merged.addAll(older);
                            messages.postValue(merged);
                        }
                        loadingMore = false;
                    }

                    @Override
                    public void onError(String errorMessage) {
                        error.postValue(errorMessage);
                        loadingMore = false;
                    }
                });
    }
}