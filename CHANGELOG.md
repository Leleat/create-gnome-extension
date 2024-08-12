# [1.0.0](https://github.com/Leleat/create-gnome-extension/compare/v0.10.0...v1.0.0) (2024-08-12)


### Bug Fixes

* limit versioned deps to actual deps in package.json ([1533add](https://github.com/Leleat/create-gnome-extension/commit/1533addba0ed99d5a3d2481849e637e87f534b15))


### Features

* use prompts package for a nicer CLI experience ([f7727f2](https://github.com/Leleat/create-gnome-extension/commit/f7727f28c06f048fae9625dabf66efbf23685c49))


### BREAKING CHANGES

* While migrating to `prompts` I removed the option to pass
arguments directly to the CLI. This was done because I don't expect any
use case where this would be necessary and it simplifies the code a bit.

Part-of: https://github.com/Leleat/create-gnome-extension/pull/57



# [0.10.0](https://github.com/Leleat/create-gnome-extension/compare/v0.9.4...v0.10.0) (2024-07-27)


### Bug Fixes

* preference methods being async ([332c517](https://github.com/Leleat/create-gnome-extension/commit/332c5174d1efa5a8d4143be5fb068ee473d07396))


### Features

* add versioning for gnome-shell and gjs types ([d771d41](https://github.com/Leleat/create-gnome-extension/commit/d771d415abf6ff1c71ac4a440b48a952e9771dd5))



## [0.9.4](https://github.com/Leleat/create-gnome-extension/compare/v0.9.3...v0.9.4) (2024-07-17)


### Bug Fixes

* change "mandatory" postinstall to optional hookup script ([7d68a73](https://github.com/Leleat/create-gnome-extension/commit/7d68a7357f6da961c084e64856c7010b5e427e12))
* fix creation of file before directory ([42167da](https://github.com/Leleat/create-gnome-extension/commit/42167da43f2fff9f3130ec60fd568ad67096cb97))



## [0.9.3](https://github.com/Leleat/create-gnome-extension/compare/v0.9.2...v0.9.3) (2024-07-17)


### Bug Fixes

* missing file in npm package ([ab37d5f](https://github.com/Leleat/create-gnome-extension/commit/ab37d5f8c9dd6750327f2afd876c88726d217123))



## [0.9.2](https://github.com/Leleat/create-gnome-extension/compare/v0.9.1...v0.9.2) (2024-07-07)


### Bug Fixes

* be more specific with `find` in build.sh ([0a1860e](https://github.com/Leleat/create-gnome-extension/commit/0a1860ed9070c48ad6ec641ffe5ae64094213066))
* don't skip installing devDependencies in build script ([661c588](https://github.com/Leleat/create-gnome-extension/commit/661c58823a019fd0dabac365199866d27085a38d))
* only execute main function when running as a script ([0384f90](https://github.com/Leleat/create-gnome-extension/commit/0384f906672a775af1718684db4322a37f8415c3))
* use of decorators in TypeScript with esbuild ([d2c094c](https://github.com/Leleat/create-gnome-extension/commit/d2c094cfd00e647a625ad5b6feef6af244bac336))



## [0.9.1](https://github.com/Leleat/create-gnome-extension/compare/v0.9.0...v0.9.1) (2024-07-05)


### Bug Fixes

* remove isMainModule check ([29ab723](https://github.com/Leleat/create-gnome-extension/commit/29ab723aa5cd0f6ee90f380b8b7cf227e2eb3229))



## 0.9.0 (2024-07-05)


### Features

* Initial release


