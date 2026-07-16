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
  * Microsoft OAuth 2.0 Minecraft 계정 인증 지원
  * 인증 정보는 Microsoft·Minecraft 공식 서비스에만 전송
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
* 🎫 **YayoLauncher 전용 1회용 서버 접속 티켓**
  * Fabric 클라이언트 모드와 Paper 플러그인을 통해 일반 클라이언트 접속 차단
  * UUID·서버·접속 challenge에 귀속된 30초 만료, 1회 소비형 티켓
  * 인증 API 또는 Redis 장애 시 미인증 접속을 허용하지 않는 fail-closed 정책


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

## 🎫 1회용 서버 접속 티켓

YayoLauncher로 실행한 클라이언트만 Paper 서버 입장 인증을 진행하도록 구성할 수 있습니다. Paper의 정품 인증은 계속 사용하므로 `online-mode=true`를 유지해야 합니다.

### 구성

| 구성요소 | 역할 |
| --- | --- |
| YayoLauncher | 현재 Microsoft Minecraft 계정과 서버 정보를 사용해 localhost 티켓 브로커 실행 |
| Fabric 인증 모드 | Paper의 challenge를 받아 런처 브로커에 새 티켓 요청 |
| Paper 플러그인 | 접속자를 최대 10초간 격리하고 API를 통해 티켓 소비 |
| Node.js 티켓 API | Minecraft 프로필 UUID를 검증하고 1회용 티켓 발급·소비 |
| Redis | 원문 대신 티켓 SHA-256 해시를 30초 TTL로 보관 |

### 접속 흐름

1. Paper가 접속한 플레이어를 격리하고 매 접속마다 새로운 32바이트 challenge를 전송합니다.
2. 필수 Fabric 모드가 런처의 loopback 브로커를 통해 티켓 API에 새 티켓을 요청합니다.
3. API가 Microsoft Minecraft access token으로 공식 프로필을 확인하고 티켓 해시를 Redis에 저장합니다.
4. Paper가 `GETDEL`로 티켓을 원자적으로 소비하고 UUID, 서버 ID, challenge와 만료 시간을 확인합니다.
5. 10초 안에 검증을 통과한 플레이어만 격리가 해제되며, 사용한 티켓은 다시 사용할 수 없습니다.

### 빠른 설정

필요 버전은 Node.js 20 이상, Java 25, Minecraft/Fabric/Paper 26.2입니다.

```console
# Fabric 모드와 Paper 플러그인 빌드
cd auth
./gradlew clean build

# 티켓 API 실행
cd ../ticket-api
npm ci
cp .env.example .env
npm start
```

대상 서버의 배포 JSON에 API 주소를 설정합니다.

```json
{
  "id": "production-26.2",
  "minecraftVersion": "26.2",
  "ticketAuth": {
    "apiBaseUrl": "https://auth.example.com"
  }
}
```

Paper 플러그인의 `server-id`는 배포 JSON의 `id`와 같아야 하며, `paper-service-token`은 API의 `PAPER_SERVICE_TOKEN`과 같은 32자 이상의 무작위 값을 사용합니다. API는 HTTPS 리버스 프록시 뒤에 배치하고 Redis와 Paper 서비스 토큰은 외부에 공개하지 않습니다.

> [!IMPORTANT]
> 이 방식은 일반 바닐라 클라이언트와 단순 티켓 재사용을 차단하지만, 사용자 PC에서 실행되는 오픈소스 런처 실행 파일을 원격으로 완벽하게 증명하는 DRM은 아닙니다. 프로토콜과 클라이언트를 직접 복제하는 공격을 절대적으로 막을 수는 없습니다.

산출물 배치, Paper `config.yml`, 필수 FabricMod 등록, Docker 예시와 보안 주의사항은 [1회용 접속 티켓 운영 문서](docs/one-time-tickets.md)를 참고하세요.

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
