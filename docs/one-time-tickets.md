# YayoLauncher 1회용 접속 티켓

이 기능은 YayoLauncher가 실행한 Fabric 26.2 클라이언트와 Paper 26.2 서버 사이에 1회용 입장 티켓을 검증합니다. Paper는 반드시 `online-mode=true`를 유지합니다.

## 구성요소 빌드

Fabric과 Paper 26.2는 Java 25가 필요합니다.

```console
cd auth
./gradlew clean build
```

결과 파일은 다음 경로에 생성됩니다.

- `auth/fabric-client/build/libs/yayo-auth-client-1.0.0.jar`
- `auth/paper-plugin/build/libs/yayo-auth-paper-1.0.0.jar`

Paper JAR을 서버의 `plugins` 디렉터리에 넣고 한 번 실행한 뒤 `plugins/YayoAuth/config.yml`을 수정합니다.

```yaml
server-id: production-26.2
ticket-api-url: https://auth.example.com
paper-service-token: 32자-이상의-무작위-서비스-토큰
authentication-timeout-ticks: 200
kick-message: YayoLauncher 인증에 실패했습니다. 런처에서 다시 접속해 주세요.
```

`server-id`는 배포 JSON의 서버 `id`와 정확히 같아야 합니다. `paper-service-token`은 티켓 API의 `PAPER_SERVICE_TOKEN`과 동일해야 하며 클라이언트나 배포 JSON에 넣지 않습니다.

## 티켓 API 운영

API는 직접 TLS를 종료하지 않으므로 localhost에 바인딩하고 Caddy, nginx 또는 같은 역할의 HTTPS 리버스 프록시 뒤에서 실행합니다.

```console
cd ticket-api
npm ci
cp .env.example .env
PAPER_SERVICE_TOKEN='32자-이상의-무작위-값' REDIS_URL='redis://127.0.0.1:6379' npm start
```

Docker를 사용하면 `compose.example.yml`을 복사해 환경 변수를 지정한 후 실행할 수 있습니다. Redis 포트는 인터넷에 공개하지 않습니다. `/health`는 프로세스 상태만 반환하며 Redis 쓰기 가능 여부를 보장하지 않습니다.

## 배포 JSON

런처가 localhost 브로커를 시작하도록 대상 서버에 HTTPS API 주소를 추가합니다.

```json
{
    "id": "production-26.2",
    "minecraftVersion": "26.2",
    "ticketAuth": {
        "apiBaseUrl": "https://auth.example.com"
    }
}
```

Fabric 인증 모드는 사용자가 끌 수 없는 필수 `FabricMod`로 배포합니다. `size`와 `SHA256`은 실제 빌드 산출물 값으로 바꿉니다.

```json
{
    "id": "net.yayokorea:yayo-auth-client:1.0.0",
    "name": "Yayo Server Authentication",
    "type": "FabricMod",
    "required": {
        "value": true,
        "def": true
    },
    "artifact": {
        "size": 0,
        "SHA256": "REPLACE_WITH_BUILD_ARTIFACT_HASH",
        "url": "https://files.example.com/mods/yayo-auth-client-1.0.0.jar"
    }
}
```

## 접속 흐름

1. Paper가 플레이어를 숨기고 모든 행동을 막은 뒤 32바이트 challenge를 보냅니다.
2. Fabric 모드가 런처의 `127.0.0.1` 브로커에 challenge를 전달합니다.
3. 런처는 현재 Minecraft access token으로 HTTPS API에 티켓을 요청합니다.
4. API는 공식 Minecraft 프로필 UUID를 확인하고 Redis에 티켓 해시를 30초간 저장합니다.
5. Fabric 모드가 티켓을 Paper에 보내면 Paper가 API에서 원자적으로 소비합니다.
6. UUID, 서버 ID, challenge, 만료 시간이 모두 맞는 경우에만 격리가 해제됩니다.

API 또는 Redis 장애, Fabric 모드 제거, 다른 런처 사용, 만료와 재사용은 모두 접속 거부로 처리됩니다.

## 보안 주의사항

- 이 기능은 일반 클라이언트 접속과 단순 티켓 재사용을 차단하지만 사용자 PC의 실행 파일을 원격으로 완벽히 증명하지는 않습니다.
- Minecraft access token, 티켓 원문, 브로커 비밀값과 Paper 서비스 토큰을 로그에 출력하지 않습니다.
- 티켓 API에는 유효한 공개 인증서를 사용하고 HTTP는 localhost 개발 환경에서만 사용합니다.
- Paper 서비스 토큰은 주기적으로 교체하고 API와 Paper 서버 외부에 복사하지 않습니다.
