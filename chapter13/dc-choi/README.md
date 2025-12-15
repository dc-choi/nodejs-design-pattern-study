# 왜 메시징인가?
서비스가 커지면 다음과 같은 일이 발생함.
- 사용자가 갑자기 몰려서 트래픽 피크가 생김.
- 한 번의 요청이 내부적으로 여러 작업을 호출해야 함.
- 메일 발송, 외부 API 호출처럼 오래 걸리는 작업들이 많아짐.
- 서비스가 여러 개로 쪼개지면서 마이크로서비스 간 연동이 필요해짐.
- IoT 장비나 모바일 앱처럼 네트워크가 불안정한 환경도 같이 붙음.

HTTP Server와 DataBase만 가지고 버티려고 하면 이런 문제가 생김.
- 피크 타임에 요청이 몰리면 바로 서버/DB 부하로 직결됨.
- 긴 작업을 처리하는 동안 요청이 물려서 응답 지연이 생김.
- 장애 상황에서 재시도·유실·중복 처리를 컨트롤하기가 어려움.
- 서비스 간 직접 호출이 늘어나면서 의존 관계가 꼬임.
- IoT 장비 쪽에서는 한 번 끊어졌다고 데이터가 통째로 날아가버리는 문제가 생김.

이 문제를 한꺼번에 정리하는 공통 해법이 바로 메시징이다.

메시징을 도입하면 요청을 처리하고 응답하는 구조에서 요청을 메시지로 남기고 다른 워커에서 처리하는 구조로 바뀜.

# 메시징 시스템의 기초

## 단방향 vs 요청/응답
### 요청/응답(Request/Response)

가장 익숙한 건 HTTP. 클라이언트가 요청을 보내고 서버가 그에 대한 응답을 돌려주고 요청 하나당 응답 하나, 1:1 매칭

이 구조의 장점은 개발하기 쉽고 디버깅하기 쉽고 UX 관점에서 바로바로 결과를 보여줄 수 있다는 점.

근데 단점도 명확함. 요청 처리 시간이 길어질수록 클라이언트가 기다려야 하고 서버 입장에서도 요청 라이프사이클 동안 리소스를 계속 잡고 있어야 하고 피크가 오면 HTTP 요청 수 자체가 폭증해서 서버가 바로 힘들어집니다.

### 단방향 메시징(One-way messaging)
발신자가 작업을 하나 던져놓고, 기다리지 않고 작업을 큐에 넣고 바로 200 OK

실제 처리 시간은 백그라운드 워커의 문제고, 큐가 버퍼 역할을 해주기 때문에 순간 피크를 흡수해 줄 수 있어요.

그럼 작업이 2초가 걸리든, 10초가 걸리든, 사용자 HTTP 요청과는 완전히 분리됨.

이게 HTTP R/R vs 메시지 기반 One-way의 핵심 차이예요.

## 메시지 유형
### Command 메시지
이 작업을 실행해라.라는 의미로 보통 Task Queue에서 소비하는 메시지들이 Command에 해당.

예: 이메일 보내기, 이미지 변환, 배치 처리 등

BullMQ, SQS, RabbitMQ Work Queue에서 처리하는 건 거의 Command 성격.

### Event 메시지
이런 일이 발생했다라는 의미로 이벤트는 누가 이걸 듣고 어떻게 반응할지는 모르지만, 알고 싶은 애들이 있으면 가져다 써라에 가까움.

예: 주문 생성됨, 결제 완료됨, 센서 값 변경됨

Kafka, Redis Streams, RabbitMQ Topic이 이런 이벤트를 잘 다룸.

### Document 메시지
실제 데이터 덩어리 자체로 작업 지시보다는 데이터 전달 자체가 목적

예: IoT telemetry payload, DB 변경 내용(CDC), 로그 레코드

## Queue vs Stream
### Queue
일을 처리하는 구조(Do Work)로 메시지를 꺼내서 처리하면 사라짐.

여러 Worker가 경쟁적으로 꺼내서 처리 (Competing Consumers)

작업 분배 + 부하 분산 + 백오프 + 재시도가 목적임.

쓰는 곳: BullMQ, RabbitMQ Queue, SQS 등

### Stream(Log)
일어난 일을 기록하는 구조(Record Events)로 메시지를 바로 지우지 않고, 시간 순서대로 기록

여러 Consumer Group이 각자 다른 offset에서 읽음

과거 이벤트 재처리 가능. (replay)

쓰는 곳: Kafka, Redis Streams

## 브로커 기반 vs P2P
지금은 거의 다 브로커 기반으로 갑니다. RabbitMQ, Kafka, Redis Streams, SQS 전부 브로커 기반.

브로커 기반은 한 군데에서 라우팅, 보관, 재시도, 백프레셔, 모니터링을 관리할 수 있음.

P2P는 속도는 빠를 수 있지만, 운영 지옥이고, 브로커는 약간의 오버헤드 대신, 운영 편의성과 안정성을 얻는 구조

실무에선 그냥 브로커 기반이 사실상 표준이다 정도로 생각하면 됩니다.

# Pub/Sub 패턴
## 개념
보내는 쪽은 누가 듣는지 모르고, 듣는 쪽은 보내는 사람이 누군지 몰라도 되는 구조

Observer 패턴을 분산 환경으로 확장한 버전.

## 분산 시스템에서의 역할
### 결합도 낮추기
직접 호출하면 A서비스가 B서비스를 알아야 하지만 Pub/Sub에서는 이벤트만 던져놓고 끝 누가 구독하고 있는지는 신경 안 씀

### 다수 소비자에게 동일 이벤트 전달
예시로 주문 완료되면 결제, 알림, 배송 등등 전부 이 이벤트에 반응할 수 있음.

### 비동기 확장성
발행자가 이벤트를 이벤트 버스에 넣어두면 소비자들이 자기 페이스대로 처리

## Durable vs Non-durable Pub/Sub
### Non-durable Pub/Sub

구독자가 연결되어 있어야만 메시지를 받음. 끊겨 있으면 그 사이 메시지는 날아감

Redis Pub/Sub, MQTT의 기본적인 느낌

### Durable Pub/Sub
메시지를 어딘가에 로그 형태로 남김. 나중에 구독자가 다시 붙어도 이전 메시지를 읽을 수 있음

Kafka, Redis Streams, RabbitMQ + Durable Queue

## 기술별 Pub/Sub 구현
### Redis Pub/Sub
초간단, 초경량하고, 유실 허용되는 신호에만 사용.

예: 캐시 무효화 신호, WebSocket 서버 간 브로드캐스트

### Redis Streams
Streams는 Durable Pub/Sub + 로그라고 생각하면 됨.

Producer
```shell
XADD mystream * field value ...
```

Consumer Group
```shell
XREADGROUP GROUP group consumer STREAMS mystream >
```

메시지가 스트림에 쌓이고 Consumer Group마다 자기 offset 관리함.

즉, Pub/Sub이면서도 Kafka처럼 이벤트를 쌓아두고 다시 읽을 수 있는 구조

### RabbitMQ Topic
RabbitMQ는 Pub/Sub을 Exchange + Queue 조합으로 구현.

Topic Exchange를 order.*, order.created, order.canceled 이런 식으로 여러 Queue가 서로 다른 라우팅 키로 같은 이벤트를 구독할 수 있음.

라우팅이 굉장히 유연하고 Durable Queue와 결합하면 Pub/Sub + Durable 모두 확보할 수 있음.

마이크로서비스 간 이벤트 라우팅에 좋음

### Kafka Topic
분산 이벤트 로그 + Pub/Sub 플랫폼.

Producer는 Topic에 이벤트를 append

Consumer Group은 각자 다른 offset에서 읽음

높은 처리량, 높은 내구성을 가지고 있어서 이벤트 기반 아키텍처의 중심축

Pub/Sub이라기보다는 Event Streaming + Pub/Sub의 상위 개념

### MQTT Pub/Sub
IOT 장치: PUBLISH sensors/weight device=xxx payload=...

서버: SUBSCRIBE sensors/#

네트워크가 불안정한 환경에서 잘 버티도록 설계되었고, QoS 0/1/2 제공.

다만, 영구 저장/리플레이를 기본 목표로 하진 않음.

그래서 MQTT만으로 “이벤트를 절대 잃지 않겠다”라고 설계하긴 위험하고, 반드시 뒤에 Queue/Stream을 두는 게 안전.

### Topic routing / Event distribution
Pub/Sub의 진짜 힘은 이벤트가 여러 서비스로 자연스럽게 흘러가는 구조에 있음.

RabbitMQ Topic, Kafka Topic, Redis Streams 등은 특정 도메인 이벤트(예: order.created)를 발행하면 관심 있는 서비스들이 각자 해당 Topic/Stream을 구독해서 자기 일을 진행하는 구조.

이게 결국 이벤트 기반 아키텍처(EDA)의 핵심.

# Task Distribution 패턴 (Worker 기반 병렬 처리)
## Task Distribution 필요성
## 경쟁 소비자 모델
## Queue 기반 구조
## 기술별 구현 비교
### BullMQ
### Redis Streams CG
### RabbitMQ Work Queue
### SQS
## Retry/Backoff/Ack
## Worker Scaling 전략

# Request/Reply 패턴
## HTTP R/R
## MQ RPC
## Redis Streams RPC
## Kafka RPC
## 비동기 요청/응답 패턴

# Event Streaming 패턴
## Queue vs Stream
## Consumer Group
## Replay
## 기술 비교 (Redis Streams vs Kafka)
## Event-driven architecture에서 Stream의 역할

# 기술별 구현 설명
## Redis 메시징 기술군
### Redis Pub/Sub
### Lists
### Sorted Sets
### Hashes
### Streams
### 장점/한계
## BullMQ
### BullMQ 구조
### Redis 자료구조 사용 방식
### 내부 Redis 명령어 흐름 분석
### Worker lifecycle
### 실무 사용 포인트
## RabbitMQ
### Exchange/Queue
### Topic/Fanout/Direct
### Work Queue
### Durable delivery
## Kafka
### Partition
### Offset
### Consumer Group
### Replication Replay
## RabbitMQ vs BullMQ vs Redis Streams vs Kafka — 4-way 기술 비교
### 기술의 정체성 비교
### 설계 철학 비교
### 데이터 구조 비교
### 확장성 모델
### 신뢰성/전달 보장
### 라우팅/토픽 기능
### 실무 선택 기준

# 실무 아키텍처 패턴 모음 (Use Cases)
## IoT Ingest Architecture (MQTT 중심)
### MQTT QoS 한계
### Durable layer 필요성
### BullMQ 기반 ingest
### Redis Streams 기반 ingest
### Kafka 기반 ingest
### MQTT + Messaging Pattern 조합 설계
## 이벤트 기반 마이크로서비스(EA) 아키텍처
## 대규모 로그/Telemetry 파이프라인

# Modern Messaging Architecture 결론
