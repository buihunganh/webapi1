package com.example.btl_adr1.api;

import android.content.Context;
import android.content.Intent;

import com.example.btl_adr1.ui.auth.LoginActivity;
import com.example.btl_adr1.utils.Constants;
import com.example.btl_adr1.utils.SessionManager;

import java.util.concurrent.TimeUnit;

import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/**
 * Singleton Retrofit client tối ưu với Auth Interceptor.
 */
public class ApiClient {

    private static Retrofit retrofit = null;
    private static ApiService apiService = null;

    /**
     * Lấy ApiService instance. Tự động xử lý Auth Token và lỗi 401.
     */
    public static ApiService getApiService(Context context) {
        if (apiService == null) {
            // Context ứng dụng để tránh rò rỉ bộ nhớ
            Context appContext = context.getApplicationContext();
            
            // Logging interceptor để debug
            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BODY);

            // Interceptor tự động thêm Header cho mọi request
            Interceptor authInterceptor = chain -> {
                SessionManager session = new SessionManager(appContext);
                Request original = chain.request();
                
                Request.Builder builder = original.newBuilder();
                
                // Thêm Token nếu đã đăng nhập
                if (session.isLoggedIn()) {
                    builder.header("Authorization", "Bearer " + session.getAuthToken());
                    builder.header("X-User-Id", String.valueOf(session.getUserId()));
                    builder.header("X-User-Role", session.getUserRole());
                    builder.header("X-User-Email", session.getUserEmail());
                }

                Response response = chain.proceed(builder.build());

                // Xử lý lỗi 401: Token hết hạn hoặc không hợp lệ
                if (response.code() == 401 && session.isLoggedIn()) {
                    session.logout();
                    Intent intent = new Intent(appContext, LoginActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    appContext.startActivity(intent);
                }
                
                return response;
            };

            OkHttpClient client = new OkHttpClient.Builder()
                    .addInterceptor(logging)
                    .addInterceptor(authInterceptor)
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(15, TimeUnit.SECONDS)
                    .writeTimeout(15, TimeUnit.SECONDS)
                    .build();

            retrofit = new Retrofit.Builder()
                    .baseUrl(Constants.BASE_URL)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
            
            apiService = retrofit.create(ApiService.class);
        }
        return apiService;
    }
}
