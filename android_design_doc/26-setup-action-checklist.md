# 26 — Setup Action Checklist

> **Mục tiêu:** Hoàn tất cấu hình project multi-module trên Android Studio.
> Khi checklist này xong → bắt đầu Phase 0 trong `25-implementation-plan.md`.
>
> **Trạng thái hiện tại:** Project "Vua Vui Ve" đã tạo tại `E:\Nam3\TaiLieuHocKi8\APP\VuaVuiVe`, có module `app` mặc định.

---

## BƯỚC 1 — Load Gradle Project ⬜

1. Bấm **"Load Gradle Project"** ở góc dưới phải
2. Đợi Gradle sync hoàn tất (thanh progress bar dưới cùng)

---

## BƯỚC 2 — Xóa module `app` mặc định ⬜

1. Menu: **File → Project Structure → Modules**
2. Chọn module `app` → nhấn nút **−** (Remove) → **OK**
3. Đóng dialog Project Structure
4. Trong **File Explorer** (bên trái), chuột phải thư mục `app/` → **Delete**
5. Confirm xóa

---

## BƯỚC 3 — Tạo module `shared` (Android Library) ⬜

1. Menu: **File → New → New Module...**
2. Chọn template: **Android Library**
3. Điền:
   - Module name: `shared`
   - Package name: `vn.vuavuive.shared`
   - Language: **Java**
   - Minimum SDK: **API 26**
   - Build configuration language: **Kotlin DSL**
4. Finish

---

## BƯỚC 4 — Tạo module `app-customer` ⬜

1. Menu: **File → New → New Module...**
2. Chọn template: **Phone & Tablet** → **No Activity**
3. Điền:
   - Module name: `app-customer`
   - Package name: `vn.vuavuive.customer`
   - Language: **Java**
   - Minimum SDK: **API 26**
   - Build configuration language: **Kotlin DSL**
4. Finish

---

## BƯỚC 5 — Tạo module `app-admin` ⬜

1. Menu: **File → New → New Module...**
2. Chọn template: **Phone & Tablet** → **No Activity**
3. Điền:
   - Module name: `app-admin`
   - Package name: `vn.vuavuive.admin`
   - Language: **Java**
   - Minimum SDK: **API 26**
   - Build configuration language: **Kotlin DSL**
4. Finish

---

## BƯỚC 6 — Kiểm tra `settings.gradle.kts` ⬜

Mở file `settings.gradle.kts` ở root project. Đảm bảo có đủ 3 module:

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

> **Lưu ý:** Nếu còn `include(":app")` → xóa dòng đó đi.

---

## BƯỚC 7 — Cấu hình `build.gradle.kts` (Root) ⬜

Mở file `build.gradle.kts` ở **root project** (không phải trong module). Thay toàn bộ nội dung:

```kotlin
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("com.android.library") version "8.9.1" apply false
    id("com.google.dagger.hilt.android") version "2.56.2" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
}
```

> **Lưu ý:** Version `8.9.1` là AGP (Android Gradle Plugin). Nếu Android Studio của bạn dùng AGP khác (ví dụ `8.7.3`), hãy giữ nguyên version mà Android Studio tự tạo. Chỉ cần **thêm** 2 dòng Hilt và GMS.

---

## BƯỚC 8 — Cấu hình `shared/build.gradle.kts` ⬜

Mở `shared/build.gradle.kts` → thay toàn bộ nội dung:

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

---

## BƯỚC 9 — Cấu hình `app-customer/build.gradle.kts` ⬜

Mở `app-customer/build.gradle.kts` → thay toàn bộ nội dung:

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

> **Lưu ý:** Plugin `com.google.gms.google-services` yêu cầu file `google-services.json`. Nếu chưa có → tạm comment dòng plugin này và bỏ dependency `play-services-auth`. Sẽ thêm lại khi setup Google Sign-In.

---

## BƯỚC 10 — Cấu hình `app-admin/build.gradle.kts` ⬜

Mở `app-admin/build.gradle.kts` → thay toàn bộ nội dung:

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

---

## BƯỚC 11 — Tạo `AndroidManifest.xml` cho Customer ⬜

Mở `app-customer/src/main/AndroidManifest.xml` → thay nội dung:

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
        android:theme="@style/Theme.Material3.DayNight.NoActionBar"
        android:usesCleartextTraffic="true">

        <!-- Activities sẽ khai báo khi triển khai Phase 1 -->

    </application>
</manifest>
```

---

## BƯỚC 12 — Tạo `AndroidManifest.xml` cho Admin ⬜

Mở `app-admin/src/main/AndroidManifest.xml` → thay nội dung:

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
        android:theme="@style/Theme.Material3.DayNight.NoActionBar"
        android:usesCleartextTraffic="true">

        <!-- Activities sẽ khai báo khi triển khai Phase 3 -->

    </application>
</manifest>
```

---

## BƯỚC 13 — Tạo `network_security_config.xml` cho CẢ 2 app ⬜

Tạo file ở 2 vị trí:
- `app-customer/src/main/res/xml/network_security_config.xml`
- `app-admin/src/main/res/xml/network_security_config.xml`

Nội dung giống nhau:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

> Chuột phải `res/` → New → Android Resource File → Resource type: XML, File name: `network_security_config`, Root element: `network-security-config`.

---

## BƯỚC 14 — Tạo Hilt Application classes ⬜

### Customer App
Tạo file `app-customer/src/main/java/vn/vuavuive/customer/VuaVuiVeApp.java`:

```java
package vn.vuavuive.customer;

import android.app.Application;
import dagger.hilt.android.HiltAndroidApp;

@HiltAndroidApp
public class VuaVuiVeApp extends Application {
}
```

### Admin App
Tạo file `app-admin/src/main/java/vn/vuavuive/admin/VuaVuiVeAdminApp.java`:

```java
package vn.vuavuive.admin;

import android.app.Application;
import dagger.hilt.android.HiltAndroidApp;

@HiltAndroidApp
public class VuaVuiVeAdminApp extends Application {
}
```

---

## BƯỚC 15 — Tạo `proguard-rules.pro` cho CẢ 2 app ⬜

Tạo/cập nhật file ở 2 vị trí:
- `app-customer/proguard-rules.pro`
- `app-admin/proguard-rules.pro`

Nội dung giống nhau:

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

---

## BƯỚC 16 — Tạo cấu trúc package trong `shared` ⬜

Trong `shared/src/main/java/vn/vuavuive/shared/`, tạo các package:

```
shared/src/main/java/vn/vuavuive/shared/
├── data/
│   ├── api/          ← Retrofit interfaces
│   ├── dto/          ← Data models (User, Product, Order...)
│   ├── local/        ← Room Database, DAOs
│   └── repository/   ← Repository pattern
├── di/               ← Hilt Modules (NetworkModule, DatabaseModule)
└── util/             ← Constants, Helpers, Interceptors
```

> Cách tạo: Chuột phải package `vn.vuavuive.shared` → **New → Package** → gõ `data.api`, lặp lại cho `data.dto`, `data.local`, `data.repository`, `di`, `util`.

---

## BƯỚC 17 — Tạo cấu trúc package trong `app-customer` ⬜

Trong `app-customer/src/main/java/vn/vuavuive/customer/`, tạo:

```
customer/
├── ui/
│   ├── auth/
│   ├── home/
│   ├── product/
│   ├── cart/
│   ├── checkout/
│   ├── order/
│   ├── account/
│   ├── recipe/
│   ├── chat/
│   └── common/
├── viewmodel/
└── di/
```

---

## BƯỚC 18 — Tạo cấu trúc package trong `app-admin` ⬜

Trong `app-admin/src/main/java/vn/vuavuive/admin/`, tạo:

```
admin/
├── ui/
│   ├── auth/
│   ├── dashboard/
│   ├── orders/
│   ├── products/
│   ├── users/
│   ├── vouchers/
│   ├── shipments/
│   ├── audit/
│   └── chatbot/
├── viewmodel/
└── di/
```

---

## BƯỚC 19 — Sync Gradle ⬜

1. Trên toolbar: **File → Sync Project with Gradle Files** (hoặc bấm icon 🐘 Sync)
2. Đợi sync hoàn tất — **KHÔNG CÓ LỖI ĐỎ**
3. Nếu lỗi:
   - AGP version mismatch → chỉnh version trong root `build.gradle.kts` cho khớp Android Studio
   - Missing `google-services.json` → comment plugin `com.google.gms.google-services` trong `app-customer/build.gradle.kts`
   - JDK 17 not found → Settings → Build → Gradle → Gradle JDK → chọn JDK 17

---

## BƯỚC 20 — Build kiểm tra ⬜

1. Trên toolbar, chọn Run Configuration: **app-customer**
2. Bấm **Build → Make Project** (Ctrl+F9)
3. Nếu build thành công → chuyển sang **app-admin** → build lại
4. Cả 2 build thành công = ✅ **SẴN SÀNG TRIỂN KHAI**

---

## ✅ KHI HOÀN TẤT TẤT CẢ 20 BƯỚC

Mở `25-implementation-plan.md` → bắt đầu **Phase 0: Foundation (shared module)**:

1. Tạo `CsrfInterceptor.java` trong `shared/util/`
2. Tạo `PortalScopeInterceptor.java` trong `shared/util/`
3. Tạo `PersistentCookieJar.java` trong `shared/util/`
4. Tạo `NetworkModule.java` trong `shared/di/`
5. Tạo Data Models (DTOs) trong `shared/data/dto/`
6. Tạo Retrofit API interfaces trong `shared/data/api/`
7. Tạo Room Database trong `shared/data/local/`

---

## Tham chiếu

- Chi tiết từng file Gradle: [24-setup-guide.md](./24-setup-guide.md)
- Lộ trình triển khai: [25-implementation-plan.md](./25-implementation-plan.md)
- API endpoints thực tế: [14-api-endpoints.md](./14-api-endpoints.md)
- Data models: [13-data-models.md](./13-data-models.md)
