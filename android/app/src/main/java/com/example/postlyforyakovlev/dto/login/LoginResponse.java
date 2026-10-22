package com.example.postlyforyakovlev.dto.login;

public class LoginResponse {
    private String id;
    private String token;
    private String username;

    public LoginResponse(String token, String username) {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    @Override
    public String toString() {
        return "id='" + id + '\'' +
                ", token='" + token + '\'' +
                ", username='" + username + '\'' +
                '}';
    }
}
