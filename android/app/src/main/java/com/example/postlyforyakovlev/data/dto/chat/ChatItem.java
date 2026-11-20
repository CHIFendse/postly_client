package com.example.postlyforyakovlev.data.dto.chat;

import com.google.gson.annotations.SerializedName;


public class ChatItem {
    @SerializedName("avatar_url")
    private String avatarUrl;

    private String id;

    @SerializedName("last_message")
    private String lastMessage;

    private String name;

    @SerializedName("updated_at")
    private Long updatedAt;

    @SerializedName("user_id")
    private String userId;

    private String username;

    public ChatItem(String avatarUrl, String id, String lastMessage, String name, Long createdAt, String userId, String username) {
        this.avatarUrl = avatarUrl;
        this.id = id;
        this.lastMessage = lastMessage;
        this.name = name;
        this.updatedAt = createdAt;
        this.userId = userId;
        this.username = username;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }


    public String getLastMessage() {
        return lastMessage;
    }

    public String getName() {
        return name;
    }

    public Long getUpdatedAt() {
        return updatedAt;
    }

    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getUsername() {
        return username;
    }

    @Override
    public String toString() {
        return "ChatItem{" +
                "avatarUrl='" + avatarUrl + '\'' +
                ", id='" + id + '\'' +
                ", lastMessage='" + lastMessage + '\'' +
                ", name='" + name + '\'' +
                ", updatedAt=" + updatedAt +
                ", userId='" + userId + '\'' +
                ", username='" + username + '\'' +
                '}';
    }
}
