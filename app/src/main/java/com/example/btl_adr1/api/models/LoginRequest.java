package com.example.btl_adr1.api.models;

import com.google.gson.annotations.SerializedName;

/**
 * Request body cho POST /api/auth/login
 */
public class LoginRequest {
    @SerializedName("email")
    private String email;

    @SerializedName("password")
    private String password;

    public LoginRequest(String email, String password) {
        this.email = email;
        this.password = password;
    }

    public String getEmail() { return email; }
    public String getPassword() { return password; }
}
