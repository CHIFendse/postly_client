package com.example.postlyforyakovlev.ui.chatlist;

import android.app.Application;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.example.postlyforyakovlev.data.dto.chat.ChatItem;
import com.example.postlyforyakovlev.data.network.ApiCallback;
import com.example.postlyforyakovlev.data.repository.ChatListRepository;

import java.util.List;

public class ChatListViewModel extends AndroidViewModel {
    private final ChatListRepository repository;
    private final MutableLiveData<List<ChatItem>> chats = new MutableLiveData<>();

    public ChatListViewModel(@NonNull Application app){
        super(app);
        repository = new ChatListRepository(app);
        loadChats();
    }

    private void loadChats(){
        repository.getChats(new ApiCallback<List<ChatItem>>() {
            @Override public void onSuccess(List<ChatItem> result) { chats.setValue(result); }
            @Override public void onError(String errorMessage) { Log.e("Chats", errorMessage); }
        });
    }

    public LiveData<List<ChatItem>> getChats(){
        return chats;
    }
}
