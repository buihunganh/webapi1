package com.example.btl_adr1.api.models;

import com.google.gson.annotations.SerializedName;

/**
 * Response cho login/register/profile APIs.
 * Flask trả về: {"ok": true, "user": {...}}
 */
public class LoginResponse {
    @SerializedName("ok")
    private boolean ok;

    @SerializedName("user")
    private User user;

    @SerializedName("error")
    private String error;

    @SerializedName(value = "token", alternate = {"access_token", "accessToken", "jwt"})
    private String token;

    public boolean isOk() { return ok; }
    public User getUser() { return user; }
    public String getError() { return error; }
    public String getToken() { return token; }
}
