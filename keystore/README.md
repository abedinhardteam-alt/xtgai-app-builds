# XTG Apps public build key

`xtgapps.jks.b64` (PKCS12, alias `xtgapps`, password `xtgapps-public`) signs every app built by the XTG AI App Builder.

It is **intentionally public** (this repo is public and holds no secrets). It is NOT the XTG AI release key and it is
never used for XTG AI itself. Effect: apps built here can be updated by later builds with the same name, but anyone
could also sign an APK with this key — treat these as personal/hobby apps, not Play Store releases.
