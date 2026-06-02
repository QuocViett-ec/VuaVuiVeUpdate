# Setup Guide: Cấu Hình Android Studio — Multi-Module Project

## 1. Kiến trúc Multi-Module

Dự án Vựa Vui Vẻ sử dụng kiến trúc **1 Project – 3 Modules**:

```
VuaVuiVe/                          ← 1 Project Android Studio
├── settings.gradle.kts
├── build.gradle.kts               ← Project-level plugins
│
├── shared/                        ← Android Library — code dùng chung
│   └── src/main/java/vn/vuavuive/shared/
│       ├── data/
│       │   ├── api/               ← Retrofit interfaces (AuthApi, ProductApi...)
│       │   ├── dto/               ← Data models (User, Product, Order...)
│       │   ├── local/             ← Room Database, DAOs, Entities
│       │   └── repository/        ← Repository pattern
│       ├── di/                    ← Hilt Modules (NetworkModule, DatabaseModule)
│       └── util/                  ← Constants, Helpers, PersistentCookieJar
│
├── app-customer/                  ← Application — Customer App
│   └── src/main/java/vn/vuavuive/customer/
│       ├── VuaVuiVeApp.java       ← @HiltAndroidApp
│       ├── ui/
│       │   ├── auth/              ← Login, Register, ForgotPassword
│       │   ├── home/              ← HomeFragment
│       │   ├── product/           ← ProductList, ProductDetail
│       │   ├── cart/              ← CartFragment
│       │   ├── checkout/          ← Checkout, PaymentWebView
│       │   ├── order/             ← OrderList, OrderDetail
│       │   ├── account/           ← Account, EditProfile
│       │   ├── recipe/            ← RecipeList
│       │   ├── chat/              ← ChatActivity (Gemini AI)
│       │   └── common/            ← BaseActivity, adapters, custom views
│       ├── viewmodel/
│       └── di/                    ← CustomerModule (portalScope = "customer")
│
└── app-admin/                     ← Application — Admin App
    └── src/main/java/vn/vuavuive/admin/
        ├── VuaVuiVeAdminApp.java  ← @HiltAndroidApp
        ├── ui/
        │   ├── auth/              ← AdminLoginActivity
        │   ├── dashboard/         ← DashboardFragment
        │   ├── orders/            ← AdminOrderList, OrderDetail, BulkUpdate
        │   ├── products/          ← AdminProductList, ProductEdit
        │   ├── users/             ← UserListFragment
        │   ├── vouchers/          ← VoucherListFragment
        │   ├── shipments/         ← ShipmentListFragment
        │   ├── audit/             ← AuditLogFragment
        │   └── chatbot/           ← AdminChatActivity
        ├── viewmodel/
        └── di/                    ← AdminModule (portalScope = "admin")
```

## 2. Tạo Project trên Android Studio

### Bước 1 — New Project
- Template: **No Activity**
- Name: `VuaVuiVe`
- Package name: `vn.vuavuive`
- Save location: `E:\Nam3\TaiLieuHocKi8\APP\VuaVuiVe`
- Language: **Java**
- Minimum SDK: **API 26 (Android 8.0 "Oreo")**
- Build configuration: **Kotlin DSL (build.gradle.kts)**

### Bước 2 — Xóa module `app` mặc định
1. File → Project Structure → Modules → chọn `app` → nhấn **−** (Remove)
2. Xóa thư mục `app/` trong file explorer

### Bước 3 — Tạo module `shared`
1. File → New → New Module → **Android Library**
2. Module name: `shared`
3. Package name: `vn.vuavuive.shared`
4. Language: Java | Minimum SDK: API 26

### Bước 4 — Tạo module `app-customer`
1. File → New → New Module → **Phone & Tablet** → **No Activity**
2. Module name: `app-customer`
3. Package name: `vn.vuavuive.customer`
4. Language: Java | Minimum SDK: API 26

### Bước 5 — Tạo module `app-admin`
1. File → New → New Module → **Phone & Tablet** → **No Activity**
2. Module name: `app-admin`
3. Package name: `vn.vuavuive.admin`
4. Language: Java | Minimum SDK: API 26

## 3. Cấu hình Gradle

### 3.1. `settings.gradle.kts` (Root)

```kotlin
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }  // MPAndroidChart
    }
}

rootProject.name = "VuaVuiVe"

include(":shared")
include(":app-customer")
include(":app-admin")
```

### 3.2. `build.gradle.kts` (Project-level — Root)

```kotlin
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("com.android.library") version "8.9.1" apply false
    id("com.google.dagger.hilt.android") version "2.56.2" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
}
```

### 3.3. `shared/build.gradle.kts`

```kotlin
plugins {
    id("com.android.library")
    id("com.google.dagger.hilt.android")
}

android {
    namespace = "vn.vuavuive.shared"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    // ── Networking: Retrofit 2 + OkHttp 4 + Gson ──
    api("com.squareup.retrofit2:retrofit:2.11.0")
    api("com.squareup.retrofit2:converter-gson:2.11.0")
    api("com.squareup.okhttp3:okhttp:4.12.0")
    api("com.squareup.okhttp3:logging-interceptor:4.12.0")
    api("com.squareup.okhttp3:okhttp-sse:4.12.0")

    // ── DI: Hilt (Dagger) ──
    api("com.google.dagger:hilt-android:2.56.2")
    annotationProcessor("com.google.dagger:hilt-compiler:2.56.2")

    // ── Local Storage: Room ──
    api("androidx.room:room-runtime:2.6.1")
    annotationProcessor("androidx.room:room-compiler:2.6.1")

    // ── Image Loading: Glide ──
    api("com.github.bumptech.glide:glide:4.16.0")
    annotationProcessor("com.github.bumptech.glide:compiler:4.16.0")

    // ── Architecture: MVVM ──
    api("androidx.lifecycle:lifecycle-viewmodel:2.8.7")
    api("androidx.lifecycle:lifecycle-livedata:2.8.7")
    api("androidx.lifecycle:lifecycle-runtime:2.8.7")

    // ── AndroidX UI ──
    api("androidx.appcompat:appcompat:1.7.0")
    api("com.google.android.material:material:1.12.0")
    api("androidx.constraintlayout:constraintlayout:2.2.1")
    api("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    api("androidx.navigation:navigation-fragment:2.8.9")
    api("androidx.navigation:navigation-ui:2.8.9")
    api("androidx.viewpager2:viewpager2:1.1.0")
}
```

> **Lưu ý:** Dùng `api()` thay vì `implementation()` để app modules kế thừa transitive dependencies.

### 3.4. `app-customer/build.gradle.kts`

```kotlin
plugins {
    id("com.android.application")
    id("com.google.dagger.hilt.android")
    id("com.google.gms.google-services")   // Google Sign-In
}

android {
    namespace = "vn.vuavuive.customer"
    compileSdk = 35

    defaultConfig {
        applicationId = "vn.vuavuive.customer"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:3000\"")
            buildConfigField("String", "PORTAL_SCOPE", "\"customer\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "BASE_URL", "\"https://api.vuavuive.vn\"")
            buildConfigField("String", "PORTAL_SCOPE", "\"customer\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation(project(":shared"))

    // Hilt (annotation processor cần khai báo lại ở app module)
    implementation("com.google.dagger:hilt-android:2.56.2")
    annotationProcessor("com.google.dagger:hilt-compiler:2.56.2")

    // Google Sign-In (chỉ Customer)
    implementation("com.google.android.gms:play-services-auth:21.3.0")

    // Location — FusedLocationProviderClient (Checkout geolocation)
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
```

### 3.5. `app-admin/build.gradle.kts`

```kotlin
plugins {
    id("com.android.application")
    id("com.google.dagger.hilt.android")
}

android {
    namespace = "vn.vuavuive.admin"
    compileSdk = 35

    defaultConfig {
        applicationId = "vn.vuavuive.admin"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:3000\"")
            buildConfigField("String", "PORTAL_SCOPE", "\"admin\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "BASE_URL", "\"https://api.vuavuive.vn\"")
            buildConfigField("String", "PORTAL_SCOPE", "\"admin\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation(project(":shared"))

    // Hilt
    implementation("com.google.dagger:hilt-android:2.56.2")
    annotationProcessor("com.google.dagger:hilt-compiler:2.56.2")

    // Chart cho Dashboard
    implementation("com.github.PhilJay:MPAndroidChart:v3.1.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
```

## 4. AndroidManifest.xml

### 4.1. Customer App (`app-customer/src/main/AndroidManifest.xml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <application
        android:name=".VuaVuiVeApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Vựa Vui Vẻ"
        android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true"
        android:theme="@style/Theme.VuaVuiVe"
        android:usesCleartextTraffic="true">

        <!-- Activities sẽ khai báo ở đây -->

    </application>
</manifest>
```

### 4.2. Admin App (`app-admin/src/main/AndroidManifest.xml`)

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

    <application
        android:name=".VuaVuiVeAdminApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="VVV Admin"
        android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true"
        android:theme="@style/Theme.VuaVuiVeAdmin"
        android:usesCleartextTraffic="true">

        <!-- Activities sẽ khai báo ở đây -->

    </application>
</manifest>
```

## 5. Network Security Config

Tạo cho cả 2 app: `src/main/res/xml/network_security_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

> `10.0.2.2` là IP localhost khi chạy trên Emulator. Nếu test thiết bị thật, thêm IP máy tính.

## 6. CSRF Interceptor (BẮT BUỘC)

Backend yêu cầu header `X-Requested-With: XMLHttpRequest` cho mọi POST/PUT/PATCH/DELETE request. Nếu thiếu → **403 "CSRF validation failed"**.

Tạo trong `shared/util/`:

```java
// shared/src/main/java/vn/vuavuive/shared/util/CsrfInterceptor.java
package vn.vuavuive.shared.util;

import java.io.IOException;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

public class CsrfInterceptor implements Interceptor {
    @Override
    public Response intercept(Chain chain) throws IOException {
        Request original = chain.request();
        String method = original.method();
        if ("POST".equals(method) || "PUT".equals(method) ||
            "PATCH".equals(method) || "DELETE".equals(method)) {
            Request request = original.newBuilder()
                    .addHeader("X-Requested-With", "XMLHttpRequest")
                    .build();
            return chain.proceed(request);
        }
        return chain.proceed(original);
    }
}
```

Thêm vào OkHttpClient trong `NetworkModule`:
```java
new OkHttpClient.Builder()
    .cookieJar(cookieJar)
    .addInterceptor(new PortalScopeInterceptor(portalScope))
    .addInterceptor(new CsrfInterceptor())      // ← BẮT BUỘC
    .addInterceptor(loggingInterceptor)
    .build();
```

## 7. ProGuard Rules (`proguard-rules.pro`)

Tạo cho cả 2 app:

```proguard
# Retrofit + Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class vn.vuavuive.shared.data.dto.** { *; }
-keep class vn.vuavuive.shared.data.api.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }
-dontwarn okio.**

# Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { <init>(...); }
```

## 8. Google Sign-In (Customer App only)

1. Tạo OAuth 2.0 Client ID tại [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn loại **Android**, package = `vn.vuavuive.customer`
3. Lấy SHA-1:
   ```bash
   keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android
   ```
4. Tải `google-services.json` → đặt vào `app-customer/`

## 9. Chạy ứng dụng

Trên toolbar Android Studio, chọn Run Configuration:
- **app-customer** → chạy Customer App
- **app-admin** → chạy Admin App

Cả 2 cài đồng thời trên 1 thiết bị (applicationId khác nhau).

## 10. Checklist

| # | Bước | Trạng thái |
|---|------|-----------|
| 1 | Tạo project No Activity, name = VuaVuiVe | ⬜ |
| 2 | Xóa module `app` mặc định | ⬜ |
| 3 | Tạo module `shared` (Android Library) | ⬜ |
| 4 | Tạo module `app-customer` (No Activity) | ⬜ |
| 5 | Tạo module `app-admin` (No Activity) | ⬜ |
| 6 | Cập nhật `settings.gradle.kts` | ⬜ |
| 7 | Cấu hình `build.gradle.kts` root | ⬜ |
| 8 | Cấu hình `shared/build.gradle.kts` | ⬜ |
| 9 | Cấu hình `app-customer/build.gradle.kts` | ⬜ |
| 10 | Cấu hình `app-admin/build.gradle.kts` | ⬜ |
| 11 | Tạo `network_security_config.xml` cho cả 2 app | ⬜ |
| 12 | Cập nhật `AndroidManifest.xml` cho cả 2 app | ⬜ |
| 13 | Tạo `CsrfInterceptor.java` (mục 6 — BẮT BUỘC) | ⬜ |
| 14 | Tạo `proguard-rules.pro` | ⬜ |
| 15 | Cấu hình Google Sign-In (Customer) | ⬜ |
| 16 | Tạo cấu trúc package theo mục 1 | ⬜ |
| 17 | Sync Gradle + Build thành công | ⬜ |
