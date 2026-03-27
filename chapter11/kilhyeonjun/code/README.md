# Chapter 11 코드 예제

Chapter 11에서 다루는 고급 레시피의 코드 예제입니다.

## 실행 방법

```bash
# 개별 파일 실행
node --experimental-vm-modules 01-db-without-queue.js

# ES 모듈 사용 파일은 package.json에 "type": "module" 필요
```

## 파일 목록

### 1. 비동기 초기화 (01-05)

| 파일 | 설명 |
|------|------|
| `01-db-without-queue.js` | 문제 상황: 초기화 전 쿼리 시 에러 발생 |
| `02-db-local-init.js` | 해결책 1: 매번 연결 상태 확인 |
| `03-db-delayed-startup.js` | 해결책 2: 모든 초기화 완료 후 실행 |
| `04-db-preinitialization-queue.js` | 해결책 3: 사전 초기화 큐 (권장) |
| `05-db-state-pattern.js` | 상태 패턴으로 구조화 |

### 2. 요청 배치 및 캐싱 (06-07)

| 파일 | 설명 |
|------|------|
| `06-batch-api.js` | 동일 요청 배치 처리 (피기백) |
| `07-cache-api.js` | TTL 기반 캐싱 + 배치 |

### 3. 비동기 작업 취소 (08-10)

| 파일 | 설명 |
|------|------|
| `08-cancel-basic.js` | 기본 패턴: cancelRequested 플래그 |
| `09-cancel-wrapper.js` | 래퍼 패턴: createCancelWrapper |
| `10-cancel-generator.js` | 제너레이터 패턴: createAsyncCancelable |

### 4. CPU 바운드 작업 (11-14)

| 파일 | 설명 |
|------|------|
| `11-subset-sum-blocking.js` | 문제 상황: 이벤트 루프 차단 |
| `12-subset-sum-interleaving.js` | 해결책 1: setImmediate 인터리빙 |
| `13-process-pool.js` | 해결책 2: 외부 프로세스 풀 |
| `13-process-worker.js` | 프로세스 풀 워커 스크립트 |
| `14-thread-pool.js` | 해결책 3: 작업자 스레드 풀 |

## 핵심 코드 스니펫

### 사전 초기화 큐

```javascript
// 04-db-preinitialization-queue.js
async query(queryString) {
  if (!this.connected) {
    return new Promise((resolve, reject) => {
      this.commandsQueue.push(() => {
        this.query(queryString).then(resolve, reject)
      })
    })
  }
  // 실제 쿼리 실행
}
```

### 요청 배치

```javascript
// 06-batch-api.js
if (runningRequests.has(key)) {
  return runningRequests.get(key)  // 피기백
}
const promise = originalApi(key)
runningRequests.set(key, promise)
promise.finally(() => runningRequests.delete(key))
```

### 제너레이터 기반 취소

```javascript
// 10-cancel-generator.js
const cancellable = createAsyncCancelable(function* () {
  const a = yield asyncStep('A')  // 취소 포인트
  const b = yield asyncStep('B')  // 취소 포인트
  return [a, b]
})
const { promise, cancel } = cancellable()
```

### 스레드 풀

```javascript
// 14-thread-pool.js
const pool = new ThreadPool(4)
const results = await Promise.all([
  pool.run({ set: [1,2,3], sum: 5 }),
  pool.run({ set: [4,5,6], sum: 10 })
])
```

## 연습문제

`exercises/` 디렉토리에서 연습문제 풀이를 확인할 수 있습니다.

| 파일 | 연습문제 |
|------|----------|
| `11.1-proxy-queue.js` | Proxy를 사용한 대기열 구현 |
| `11.2-callback-batch-cache.js` | 콜백 기반 배치 및 캐싱 |
| `11.3-deep-cancelable.js` | Deep 취소 가능한 비동기 함수 |
| `11.4-computing-farm.js` | 컴퓨팅 팜 (HTTP + eval/vm) |
