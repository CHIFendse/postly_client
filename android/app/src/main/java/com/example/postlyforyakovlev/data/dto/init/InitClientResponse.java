package com.example.postlyforyakovlev.data.dto.init;

import com.example.postlyforyakovlev.data.dto.chat.ChatItem;
import com.example.postlyforyakovlev.data.dto.chat.Friend;
import com.example.postlyforyakovlev.data.dto.chat.FriendRequest;
import com.example.postlyforyakovlev.data.dto.chat.Group;
import com.example.postlyforyakovlev.data.dto.chat.SentRequest;
import com.google.gson.annotations.SerializedName;

import java.util.List;

public class InitClientResponse {
//    private List<Friend> friends;
//    @SerializedName("friend_requests")
//    private List<FriendRequest> friendRequests;
    private List<ChatItem> chats;
//    private List<Group> groups;
//    @SerializedName("sent_requests")
//    private List<SentRequest> sentRequests;


    public InitClientResponse(List<ChatItem> chats) {
        this.chats = chats;
    }

    public List<ChatItem> getChats(){
        return chats;
    }
}
