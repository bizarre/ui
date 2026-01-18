# [2.0.0](https://github.com/bizarre/ui/compare/v1.4.0...v2.0.0) (2026-01-18)


* Merge pull request [#1](https://github.com/bizarre/ui/issues/1) from bizarre/inlay ([89c5736](https://github.com/bizarre/ui/commit/89c5736bc085d47563ddd9aadb23be6ed8e7bed0))


### Bug Fixes

* better clipboard handling ([fcd7006](https://github.com/bizarre/ui/commit/fcd700688080c9b86ce613592773184fd8ae3ef2))
* empty state caret rendering ([b8602d6](https://github.com/bizarre/ui/commit/b8602d6a68864051e970e80a34230bdcf10478a0))
* **inlay:** autocomplete ([bcab1c8](https://github.com/bizarre/ui/commit/bcab1c8bd554ae5097407af8cb7174e836782124))
* **inlay:** IME composition ([3d9aeb3](https://github.com/bizarre/ui/commit/3d9aeb3a1e8aa24cb06bcbcb43baec812e61d48b))
* **inlay:** prevent crash and caret issues with many diverging tokens ([130dcac](https://github.com/bizarre/ui/commit/130dcac0c3ae1776bcd85ccd194c520dabe27c62))
* performance, flaky tests, etc ([bc245b0](https://github.com/bizarre/ui/commit/bc245b023179301182878cdf2584505c74b49af5))
* tests ([1f6c9c9](https://github.com/bizarre/ui/commit/1f6c9c9bf0344ba0baf23d60d9db8bfeec121713))
* **tests:** update tests ([37efaf8](https://github.com/bizarre/ui/commit/37efaf8a89cb45de60042c5c23fd1971d62043b5))
* **vitest:** exclude ct tests ([65fa72c](https://github.com/bizarre/ui/commit/65fa72c341d06d11c200af391ccda23b8e125a41))


### Features

* handle overlapping matches better ([2cdea0d](https://github.com/bizarre/ui/commit/2cdea0d7db9aac64681a02bc5829ef87c69e6d33))
* **inlay:** init ([8c792ce](https://github.com/bizarre/ui/commit/8c792cee926f23e89a4c4653b9fc18dc324983d9))
* **inlay:** portal improvements ([b5ad6ce](https://github.com/bizarre/ui/commit/b5ad6ce0eb4235092e62e9d7902885eccfdede63))
* mobile ([0626207](https://github.com/bizarre/ui/commit/06262072b1f964308c5ec16a411cf3f029881692))
* portal rework ([b801fb3](https://github.com/bizarre/ui/commit/b801fb370197bb8a28cc1e5eb43f3858d1288c91))
* **structured-inlay:** portal anchor ([5c26a96](https://github.com/bizarre/ui/commit/5c26a9699e4d841bc8fd45d0bc0a3d4b950493aa))
* **structured-inlay:** stable token ids ([d48c109](https://github.com/bizarre/ui/commit/d48c10923ce047086815f796a542d376bb10842d))
* **tests:** run playwright tests in CI ([ca477d0](https://github.com/bizarre/ui/commit/ca477d091cf103f37e847d5b3976f6a9bbd7e813))


### BREAKING CHANGES

* - feat: new component "Inlay", structured text input primitive
- tests: playwright ct testing
- refactor: timeslice -> chrono
- chore: landing page rework

# [1.4.0](https://github.com/bizarre/ui/compare/v1.3.0...v1.4.0) (2025-05-08)


### Features

* **time-slice:** smarter default input formatter; add support for future time ranges from natural language ([a6b1b62](https://github.com/bizarre/ui/commit/a6b1b629bbf7ef2a17d04aa8c88962277ffefd4a))

# [1.3.0](https://github.com/bizarre/ui/compare/v1.2.0...v1.3.0) (2025-05-08)


### Features

* **time-slice:** allow always absolute formatting via null formatInput prop ([a2dc3a3](https://github.com/bizarre/ui/commit/a2dc3a3a74fa551c90a7c8bb125d04dddecd3c12))

# [1.2.0](https://github.com/bizarre/ui/compare/v1.1.4...v1.2.0) (2025-05-08)


### Features

* **date-parser:** parse future time ranges ([8feba0f](https://github.com/bizarre/ui/commit/8feba0f616245e391a23f0fc17e32756eeffb2cd))

## [1.1.4](https://github.com/bizarre/ui/compare/v1.1.3...v1.1.4) (2025-05-08)


### Bug Fixes

* **docs:** more applicable example ([b00e8bc](https://github.com/bizarre/ui/commit/b00e8bc96a28d5e009fa43d33137afbceda91b8d))

## [1.1.3](https://github.com/bizarre/ui/compare/v1.1.2...v1.1.3) (2025-05-08)


### Bug Fixes

* **build:** correct package.json paths ([185f40c](https://github.com/bizarre/ui/commit/185f40cc0b01cb5f888e7fcff476fefa93a32f8c))

## [1.1.3](https://github.com/bizarre/ui/compare/v1.1.2...v1.1.3) (2025-05-08)


### Bug Fixes

* **build:** correct package.json paths ([185f40c](https://github.com/bizarre/ui/commit/185f40cc0b01cb5f888e7fcff476fefa93a32f8c))

## [1.1.3](https://github.com/bizarre/ui/compare/v1.1.2...v1.1.3) (2025-05-08)


### Bug Fixes

* **build:** correct package.json paths ([185f40c](https://github.com/bizarre/ui/commit/185f40cc0b01cb5f888e7fcff476fefa93a32f8c))

## [1.1.3](https://github.com/bizarre/ui/compare/v1.1.2...v1.1.3) (2025-05-08)


### Bug Fixes

* actually publish built package (lol) ([286993b](https://github.com/bizarre/ui/commit/286993be055aaf5eeb30cc6eeeccffe66beb0aab))
* **types:** add typesVersions field to support subpath imports ([eb41f65](https://github.com/bizarre/ui/commit/eb41f650192ef764a66eab5fbcff0b91c84e223a))

## [1.1.2](https://github.com/bizarre/ui/compare/v1.1.1...v1.1.2) (2025-05-08)


### Bug Fixes

* **types:** correct TimeSlice type declaration path in exports field ([c8838f2](https://github.com/bizarre/ui/commit/c8838f2a1350477a5192f63f2e6c23af5857d147))

## [1.1.1](https://github.com/bizarre/ui/compare/v1.1.0...v1.1.1) (2025-05-08)


### Bug Fixes

* round distance instead of flooring in default input formatter ([18489b6](https://github.com/bizarre/ui/commit/18489b6d917ae0993afa21266f0d0876d1080231))

# [1.1.0](https://github.com/bizarre/ui/compare/v1.0.3...v1.1.0) (2025-05-07)


### Features

* default time slice to user timezone ([1d22434](https://github.com/bizarre/ui/commit/1d22434d12609801c8fb5c2e5afd772878ad6a4c))

## [1.0.3](https://github.com/bizarre/ui/compare/v1.0.2...v1.0.3) (2025-05-07)


### Bug Fixes

* add ajv ([be91c85](https://github.com/bizarre/ui/commit/be91c852ef4f640bbd520ff3d5fa348c1cd26143))
* add changelog ([0b3b701](https://github.com/bizarre/ui/commit/0b3b7013ae516bce8158e97e4cf3618d574e29ef))
* Optimize build to reduce package size ([e325f21](https://github.com/bizarre/ui/commit/e325f2136790160096d4c44933722df33f7fb545))
