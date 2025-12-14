<p align="center">
  <img src="./app/assets/images/Icon.png" width="150px" height="150px" alt="yayolauncher">
</p>

<h1 align="center">YayoLauncher</h1>

<h3 align="center">
  <a href="https://github.com/dscalzi/HeliosLauncher">Based on Helios Launcher</a> ·
  <a href="https://github.com/peunsu/MRSLauncher">Customized from MRS Launcher</a>
</h3>

<p align="center">
  <a href="https://github.com/yayokorea/YayoLauncher/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/yayokorea/YayoLauncher/build.yml?branch=master&style=for-the-badge" alt="gh actions">
  </a>
  <a href="https://github.com/yayokorea/YayoLauncher/releases">
    <img src="https://img.shields.io/github/downloads/yayokorea/YayoLauncher/total.svg?style=for-the-badge" alt="downloads">
  </a>
</p>

<p align="center">
Java, Forge, 모드 설치 걱정 없이 서버에 접속하세요.  
<strong>YayoLauncher 하나로 준비 끝!</strong>
</p>

---

## ✨ 기능

* 🔒 **통합 계정 관리**
  * 여러 계정을 등록하고 쉽게 계정 전환 가능
  * Microsoft (OAuth 2.0) + Mojang (Yggdrasil) 인증 지원
  * 계정 정보는 저장되지 않으며 Mojang/Microsoft 서버로 직접 전송
* 📂 **효율적인 데이터 관리**
  * 클라이언트 업데이트 자동 처리
  * 실행 전 파일 무결성 검사 및 자동 복구
* ☕ **자동 Java 유효성 검사**
  * 호환되지 않는 Java 버전이 감지되면 자동 설치
  * 런처 실행을 위해 Java를 사전 설치할 필요 없음
* 📰 런처 내장 뉴스 피드
* ⚙️ 직관적인 Java 설정 UI
* 여러 모드팩 간 손쉬운 전환
* 런처 자동 업데이트 지원
* Mojang 서비스 상태 확인


---

## 📥 다운로드

[GitHub Releases](https://github.com/yayokorea/YayoLauncher/releases)에서 다운로드할 수 있어요.

#### 최신 릴리즈

[![](https://img.shields.io/github/v/release/yayokorea/YayoLauncher?style=flat-square)](https://github.com/yayokorea/YayoLauncher/releases/latest)

#### 프리릴리즈

[![](https://img.shields.io/github/v/release/yayokorea/YayoLauncher?include_prereleases&label=pre-release&style=flat-square)](https://github.com/yayokorea/YayoLauncher/releases)

### 지원 플랫폼

| 플랫폼 | 파일 |
|------|------|
| Windows x64 | `YayoLauncher-setup-VERSION.exe` |
| macOS x64 | `YayoLauncher-setup-VERSION-x64.dmg` |
| macOS arm64 | `YayoLauncher-setup-VERSION-arm64.dmg` |
| Linux x64 | `YayoLauncher-setup-VERSION.AppImage` |

> ⚠️ macOS 설치 파일은 서명되지 않아 보안 경고가 표시될 수 있습니다.

---

## 🖥 콘솔

콘솔 창 열기:

```console
ctrl + shift + i
```

콘솔은 개발 및 디버깅 용도로 제공됩니다.
인터넷이나 타인이 안내한 코드를 무분별하게 입력하지 마세요.

---

## 🛠 개발

### 시스템 요구사항

* [Node.js][nodejs] v20

### 시작하기

```console
git clone https://github.com/yayokorea/YayoLauncher.git
cd YayoLauncher
npm install
npm start
```

### 인스톨러 빌드

```console
npm run dist
```

| 플랫폼     | 명령어                  |
| ------- | -------------------- |
| Windows | `npm run dist:win`   |
| macOS   | `npm run dist:mac`   |
| Linux   | `npm run dist:linux` |

> macOS 빌드는 macOS 환경에서만 가능합니다.

---

## 📜 라이선스 & 출처

YayoLauncher는 오픈소스 프로젝트인
**Helios Launcher → MRS Launcher**를 기반으로 한 파생 프로젝트입니다.

* Original Project: [Helios Launcher](https://github.com/dscalzi/HeliosLauncher)
* Intermediate Fork: [MRS Launcher](https://github.com/peunsu/MRSLauncher)

본 프로젝트는 원본 프로젝트의 라이선스를 그대로 따릅니다.

> 본 프로젝트는 원작자와 공식적으로 제휴되거나 승인받은 프로젝트가 아닙니다.

---

## 🔗 리소스

* [Helios Launcher Wiki][wiki]
* [Nebula (Distribution.json Generator)][nebula]
* [Helios v2 Rewrite Branch][v2branch]

---

[nodejs]: https://nodejs.org/en/
[wiki]: https://github.com/dscalzi/HeliosLauncher/wiki
[nebula]: https://github.com/dscalzi/Nebula
[v2branch]: https://github.com/dscalzi/HeliosLauncher/tree/ts-refactor