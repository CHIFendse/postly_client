package com.example.postlyforyakovlev.dto.registration;

public class RegistrationResponse {
    private String status;
//    private String message;


    public RegistrationResponse(String status) {
        this.status = status;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

//    public String getMessage() {
//        return message;
//    }
//
//    public void setMessage(String message) {
//        this.message = message;
//    }
}
