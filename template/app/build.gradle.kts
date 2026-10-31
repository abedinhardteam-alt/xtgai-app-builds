plugins { id("com.android.application") }
android {
  namespace = "com.ishaq.xtgapps.shell"
  compileSdk = 34
  defaultConfig {
    applicationId = "__PKG__"
    minSdk = 24; targetSdk = 34
    versionCode = __VC__; versionName = "__VN__"
  }
  buildTypes { release { isMinifyEnabled = false } }
  compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
  lint { checkReleaseBuilds = false; abortOnError = false }
}
