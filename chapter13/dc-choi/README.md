# 왜 메시징인가?

# 메시징 시스템의 기초
## 단방향 vs 요청/응답
## 메시지 유형
## Queue vs Stream
## 브로커 기반 vs P2P
## MQTT의 위치 (ingress 프로토콜)

# Pub/Sub 패턴
## 개념
## 분산 시스템에서의 역할
## Durable vs Non-durable Pub/Sub
## 기술별 Pub/Sub 구현
### Redis Pub/Sub
### Redis Streams
### RabbitMQ Topic
### Kafka Topic
### MQTT Pub/Sub
### Topic routing / Event distribution

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
