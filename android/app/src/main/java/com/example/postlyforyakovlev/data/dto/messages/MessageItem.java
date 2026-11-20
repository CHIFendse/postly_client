package com.example.postlyforyakovlev.data.dto.messages;

import com.google.gson.annotations.SerializedName;

public class MessageItem {
    @SerializedName("id") private String id;
    @SerializedName("chat_id") private String chatId;
    @SerializedName("sender_id") private String senderId;
    @SerializedName("username") private String username;
    @SerializedName("text") private String text;
    @SerializedName("message_type") private String messageType;
    @SerializedName("created_at") private long createdAt; // миллисекунды
    @SerializedName("file_url") private String fileUrl;
    @SerializedName("file_name") private String fileName;
    @SerializedName("file_size") private String fileSize; // строка, у текста ""

    public String getId() { return id; }
    public String getChatId() { return chatId; }
    public String getSenderId() { return senderId; }
    public String getUsername() { return username; }
    public String getText() { return text == null ? "" : text; }
    public String getMessageType() { return messageType; }
    public long getCreatedAt() {
        return createdAt < 1_000_000_000_000L ? createdAt * 1000 : createdAt;
    }
    public String getFileUrl() { return fileUrl; }
    public String getFileName() { return fileName; }
    public String getFileSize() { return fileSize; }

    public boolean isFile() {
        return messageType != null && !"text".equals(messageType);
    }
}