import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

val localProperties = Properties().apply {
    val localPropsFile = rootProject.file("local.properties")
    if (localPropsFile.exists()) {
        localPropsFile.inputStream().use { load(it) }
    }
}

val dotEnvProperties = mutableMapOf<String, String>().apply {
    val envFile = rootProject.file(".env")
    if (envFile.exists()) {
        envFile.readLines()
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("#") && it.contains("=") }
            .forEach { line ->
                val idx = line.indexOf('=')
                if (idx > 0 && idx < line.length - 1) {
                    val key = line.substring(0, idx).trim()
                    val value = line.substring(idx + 1).trim().removeSurrounding("\"")
                    this[key] = value
                }
            }
    }
}

fun resolveConfig(vararg keys: String, default: String = ""): String {
    for (key in keys) {
        val fromLocal = localProperties.getProperty(key)
        if (!fromLocal.isNullOrBlank()) return fromLocal

        val fromProject = project.findProperty(key) as String?
        if (!fromProject.isNullOrBlank()) return fromProject

        val fromEnv = System.getenv(key)
        if (!fromEnv.isNullOrBlank()) return fromEnv

        val fromDotEnv = dotEnvProperties[key]
        if (!fromDotEnv.isNullOrBlank()) return fromDotEnv
    }
    return default
}

val apiBaseUrl = resolveConfig("API_BASE_URL", default = "http://10.0.2.2:5500/").trim()

val supabaseUrl = resolveConfig("SUPABASE_URL", default = "").trim()

val supabaseAnonKey = resolveConfig(
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    default = ""
).trim()

val supabaseBucket = resolveConfig("SUPABASE_BUCKET", default = "product-images").trim()

fun asBuildConfigString(value: String): String {
    return "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
}

android {
    namespace = "com.example.btl_adr1"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.example.btl_adr1"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "API_BASE_URL", asBuildConfigString(apiBaseUrl))
        buildConfigField("String", "SUPABASE_URL", asBuildConfigString(supabaseUrl))
        buildConfigField("String", "SUPABASE_ANON_KEY", asBuildConfigString(supabaseAnonKey))
        buildConfigField("String", "SUPABASE_BUCKET", asBuildConfigString(supabaseBucket))

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.appcompat)
    implementation(libs.material)
    implementation(libs.activity)
    implementation(libs.constraintlayout)
    implementation(libs.splashscreen)

    // Networking - Retrofit + OkHttp + Gson
    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.gson)

    // Image loading
    implementation(libs.glide)

    // UI Components
    implementation(libs.cardview)
    implementation(libs.recyclerview)
    implementation(libs.swiperefreshlayout)
    implementation(libs.viewpager2)

    // Mapbox Maps SDK
    implementation(libs.mapbox.maps)

    // Location Services
    implementation(libs.play.services.location)

    testImplementation(libs.junit)
    androidTestImplementation(libs.ext.junit)
    androidTestImplementation(libs.espresso.core)
}