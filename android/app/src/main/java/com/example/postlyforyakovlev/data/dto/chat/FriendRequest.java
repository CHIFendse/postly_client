package com.example.postlyforyakovlev.data.dto.chat;

import com.google.gson.annotations.SerializedName;

public class FriendRequest {
    @SerializedName("avatar_url")
    private String avatarUrl;

    @SerializedName("created_at")
    private Long createdAt;

    private Long id;

    @SerializedName("receiver_id")
    private Long receiverId;

    @SerializedName("sender_id")
    private Long senderId;

    private String username;
}
