# Chapter 13 코드 예제

## 예제 목록

| 파일명 | 설명 |
|--------|------|
| `01-request-reply-process.js` | child_process를 사용한 요청/응답 패턴 구현 |
| `02-correlation-id-pattern.js` | 상관 식별자(Correlation ID) 패턴 추상화 |

## 연습문제

| 파일명 | 연습문제 |
|--------|----------|
| `exercises/13.3-stop-workers.js` | 작업 중지 로직 (핵심 구조) |
| `exercises/13.5-data-collector.js` | 데이터 수집기 추상화 (핵심 구조) |

## 실행 방법

### 01-request-reply-process.js

요청자(requestor)와 응답자(replier)가 child_process를 통해 통신하는 예제입니다.

```bash
node 01-request-reply-process.js
```

### 02-correlation-id-pattern.js

상관 식별자 패턴의 핵심 추상화를 보여줍니다. 실제 채널 대신 EventEmitter를 사용하여 동작을 시뮬레이션합니다.

```bash
node 02-correlation-id-pattern.js
```

### exercises/13.3-stop-workers.js

해시썸 크래커에서 일치 항목 발견 시 모든 작업자를 중지하는 로직입니다.

```bash
node exercises/13.3-stop-workers.js
```

**핵심 개념:**
- 브로드캐스트 메시지로 중지 신호 전파
- 각 작업자의 상태 플래그 관리
- EventEmitter 기반 메시지 버스

### exercises/13.5-data-collector.js

모든 노드에 요청을 보내고 응답을 집계하는 추상화입니다.

```bash
node exercises/13.5-data-collector.js
```

**핵심 개념:**
- 게시/구독으로 요청 브로드캐스트
- 상관 식별자로 응답 매칭
- 타임아웃 기반 집계 완료

## 참고사항

- 이 예제들은 **외부 의존성 없이** 순수 Node.js로 작성되었습니다
- Redis, ZeroMQ, RabbitMQ 등의 외부 서비스가 필요한 예제는 README.md에서 개념만 설명합니다
- 연습문제는 핵심 로직과 구조만 포함합니다
