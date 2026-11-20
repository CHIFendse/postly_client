package com.example.postlyforyakovlev.data.dto.chat;

import com.google.gson.annotations.SerializedName;

public class Group {
    private Long id;
    @SerializedName("last_message")
    private String lastMessage;
    private String name;
    @SerializedName("updated_at")
    private Long updatedAt;
    private String username;
}
