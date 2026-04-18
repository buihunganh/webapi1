package com.example.btl_adr1.utils;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.webkit.MimeTypeMap;

import androidx.annotation.NonNull;

import com.example.btl_adr1.BuildConfig;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

public final class SupabaseStorageUploader {

    public interface UploadCallback {
        void onSuccess(@NonNull String publicUrl);
        void onError(@NonNull String message);
    }

    private static final OkHttpClient CLIENT = new OkHttpClient();
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private SupabaseStorageUploader() {
    }

    public static void uploadProductImage(@NonNull Context context,
                                          @NonNull Uri imageUri,
                                          @NonNull UploadCallback callback) {
        String baseUrl = normalizeSupabaseBaseUrl(BuildConfig.SUPABASE_URL);
        String anonKey = BuildConfig.SUPABASE_ANON_KEY;
        String bucket = BuildConfig.SUPABASE_BUCKET;

        if (TextUtils.isEmpty(baseUrl) || TextUtils.isEmpty(anonKey) || TextUtils.isEmpty(bucket)) {
            postError(callback, "Thieu cau hinh Supabase. Hay set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BUCKET trong local.properties");
            return;
        }

        EXECUTOR.execute(() -> {
            try {
                String mimeType = resolveMimeType(context.getContentResolver(), imageUri);
                byte[] bytes = readAllBytes(context.getContentResolver(), imageUri);
                if (bytes == null || bytes.length == 0) {
                    postError(callback, "Khong doc duoc du lieu anh tu thiet bi");
                    return;
                }

                String ext = extensionFromMimeType(mimeType);
                String objectPath = "products/" + System.currentTimeMillis() + "-" + UUID.randomUUID() + "." + ext;
                String encodedObjectPath = Uri.encode(objectPath, "/");
                String uploadUrl = baseUrl + "/storage/v1/object/" + Uri.encode(bucket) + "/" + encodedObjectPath;

                Request request = new Request.Builder()
                        .url(uploadUrl)
                        .header("apikey", anonKey)
                        .header("Authorization", "Bearer " + anonKey)
                        .header("x-upsert", "true")
                        .post(RequestBody.create(bytes, MediaType.parse(mimeType)))
                        .build();

                try (Response response = CLIENT.newCall(request).execute()) {
                    if (!response.isSuccessful()) {
                        String detail = readBodyText(response.body());
                        postError(callback, "Upload Supabase that bai (HTTP " + response.code() + "): " + detail);
                        return;
                    }
                }

                String publicUrl = baseUrl + "/storage/v1/object/public/" + Uri.encode(bucket) + "/" + encodedObjectPath;
                postSuccess(callback, publicUrl);
            } catch (Exception e) {
                postError(callback, "Khong the upload anh: " + e.getMessage());
            }
        });
    }

    private static String trimTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private static String normalizeSupabaseBaseUrl(String rawValue) {
        String base = trimTrailingSlash(rawValue);
        if (TextUtils.isEmpty(base)) {
            return "";
        }

        String normalized = base;

        int storagePathIndex = normalized.indexOf("/storage/v1");
        if (storagePathIndex > 0) {
            normalized = normalized.substring(0, storagePathIndex);
        }

        normalized = trimTrailingSlash(normalized);

        if (normalized.contains(".storage.supabase.co")) {
            try {
                Uri uri = Uri.parse(normalized);
                String host = uri.getHost();
                if (!TextUtils.isEmpty(host) && host.endsWith(".storage.supabase.co")) {
                    String projectRef = host.substring(0, host.indexOf(".storage.supabase.co"));
                    return uri.getScheme() + "://" + projectRef + ".supabase.co";
                }
            } catch (Exception ignored) {
                return normalized;
            }
        }

        return normalized;
    }

    private static String resolveMimeType(ContentResolver resolver, Uri uri) {
        String type = resolver.getType(uri);
        if (!TextUtils.isEmpty(type)) {
            return type;
        }

        String ext = MimeTypeMap.getFileExtensionFromUrl(uri.toString());
        if (!TextUtils.isEmpty(ext)) {
            String guessed = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase(Locale.US));
            if (!TextUtils.isEmpty(guessed)) {
                return guessed;
            }
        }
        return "image/jpeg";
    }

    private static String extensionFromMimeType(String mimeType) {
        String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType);
        if (TextUtils.isEmpty(ext)) {
            return "jpg";
        }
        return ext;
    }

    private static byte[] readAllBytes(ContentResolver resolver, Uri uri) throws IOException {
        try (InputStream in = resolver.openInputStream(uri);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) {
                return null;
            }
            byte[] buffer = new byte[8 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    private static String readBodyText(ResponseBody body) throws IOException {
        if (body == null) {
            return "no response body";
        }
        String text = body.string();
        return TextUtils.isEmpty(text) ? "empty response body" : text;
    }

    private static void postSuccess(@NonNull UploadCallback callback, @NonNull String publicUrl) {
        MAIN.post(() -> callback.onSuccess(publicUrl));
    }

    private static void postError(@NonNull UploadCallback callback, @NonNull String message) {
        MAIN.post(() -> callback.onError(message));
    }
}
