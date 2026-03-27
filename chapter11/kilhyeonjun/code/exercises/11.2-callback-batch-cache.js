/**
 * 11.2-callback-batch-cache.js
 * 연습문제 11.2: 콜백 기반 배치 및 캐싱
 *
 * Promise 없이 순수 콜백 방식으로
 * 요청 배치 및 캐싱 구현
 */

/**
 * 콜백 기반 배치 래퍼
 *
 * @param {Function} originalFn - 원본 비동기 함수 (key, callback)
 * @returns {Function} 배치가 적용된 함수
 */
function createBatchedCallback(originalFn) {
  // 진행 중인 요청 저장: key -> [callback1, callback2, ...]
  const pendingRequests = new Map()

  return function batchedFn(key, callback) {
    // 이미 진행 중인 요청이 있으면 콜백만 추가
    if (pendingRequests.has(key)) {
      console.log(`[Batch] Piggybacking on: ${key}`)
      pendingRequests.get(key).push(callback)
      return
    }

    // 새 요청 시작
    console.log(`[Batch] Starting new request: ${key}`)
    pendingRequests.set(key, [callback])

    originalFn(key, (err, result) => {
      // 대기 중인 모든 콜백 호출
      const callbacks = pendingRequests.get(key)
      pendingRequests.delete(key)

      console.log(`[Batch] Notifying ${callbacks.length} callbacks for: ${key}`)
      callbacks.forEach(cb => cb(err, result))
    })
  }
}

/**
 * 콜백 기반 캐시 + 배치 래퍼
 *
 * @param {Function} originalFn - 원본 비동기 함수 (key, callback)
 * @param {number} ttlMs - 캐시 TTL (밀리초)
 * @returns {Object} { cachedFn, invalidate, invalidateAll }
 */
function createCachedCallback(originalFn, ttlMs = 5000) {
  const pendingRequests = new Map()
  const cache = new Map()

  function cachedFn(key, callback) {
    // 1. 캐시 확인
    const cached = cache.get(key)
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < ttlMs) {
        console.log(`[Cache] HIT for ${key} (age: ${age}ms)`)
        // 비동기로 콜백 호출 (Zalgo 방지)
        setImmediate(() => callback(null, cached.value))
        return
      }
      console.log(`[Cache] EXPIRED for ${key}`)
      cache.delete(key)
    }

    // 2. 배치 확인
    if (pendingRequests.has(key)) {
      console.log(`[Batch] Piggybacking on: ${key}`)
      pendingRequests.get(key).push(callback)
      return
    }

    // 3. 새 요청
    console.log(`[Cache] MISS for ${key}`)
    pendingRequests.set(key, [callback])

    originalFn(key, (err, result) => {
      const callbacks = pendingRequests.get(key)
      pendingRequests.delete(key)

      // 성공 시 캐시에 저장
      if (!err) {
        cache.set(key, {
          value: result,
          timestamp: Date.now()
        })
      }

      callbacks.forEach(cb => cb(err, result))
    })
  }

  // 캐시 무효화
  function invalidate(key) {
    console.log(`[Cache] Invalidating: ${key}`)
    cache.delete(key)
  }

  function invalidateAll() {
    console.log(`[Cache] Invalidating all`)
    cache.clear()
  }

  return { cachedFn, invalidate, invalidateAll }
}

// 테스트용 느린 API (콜백 기반)
function slowApiCallback(key, callback) {
  console.log(`[API] Request started for: ${key}`)
  setTimeout(() => {
    console.log(`[API] Request completed for: ${key}`)
    callback(null, {
      key,
      data: `Result for ${key}`,
      timestamp: Date.now()
    })
  }, 500)
}

// 테스트
function runTests() {
  console.log('=== Callback-based Batch & Cache Demo ===\n')

  // 1. 배치만 적용
  console.log('--- Test 1: Batching Only ---')
  const batchedApi = createBatchedCallback(slowApiCallback)

  let completed = 0
  const checkComplete = (expected, next) => {
    return (err, result) => {
      completed++
      console.log(`[Result] Received:`, result?.key)
      if (completed === expected && next) {
        setTimeout(next, 100)
      }
    }
  }

  // 동시에 3개의 동일한 요청
  batchedApi('user:1', checkComplete(3))
  batchedApi('user:1', checkComplete(3))
  batchedApi('user:1', checkComplete(3, testCaching))

  // 2. 캐시 + 배치 적용
  function testCaching() {
    console.log('\n--- Test 2: Caching + Batching ---')
    completed = 0

    const { cachedFn, invalidate } = createCachedCallback(slowApiCallback, 2000)

    // 첫 번째 호출 (캐시 미스)
    cachedFn('user:2', (err, result) => {
      console.log('[Result 1] First call:', result?.key)

      // 두 번째 호출 (캐시 히트)
      cachedFn('user:2', (err, result) => {
        console.log('[Result 2] Second call (should be cached):', result?.key)

        // 캐시 무효화 후 세 번째 호출
        invalidate('user:2')
        cachedFn('user:2', (err, result) => {
          console.log('[Result 3] Third call (after invalidation):', result?.key)

          testConcurrent()
        })
      })
    })
  }

  // 3. 동시 요청 + 캐시
  function testConcurrent() {
    console.log('\n--- Test 3: Concurrent Requests with Cache ---')
    completed = 0

    const { cachedFn } = createCachedCallback(slowApiCallback, 5000)

    const done = (label) => (err, result) => {
      completed++
      console.log(`[${label}] Got:`, result?.key)
      if (completed === 4) {
        console.log('\n=== All Tests Complete ===')
      }
    }

    // 동시 요청 - 첫 번째는 API 호출, 나머지는 배치
    cachedFn('user:3', done('Request A'))
    cachedFn('user:3', done('Request B'))
    cachedFn('user:3', done('Request C'))

    // 약간의 딜레이 후 요청 - 캐시 히트
    setTimeout(() => {
      cachedFn('user:3', done('Request D (delayed)'))
    }, 600)
  }
}

runTests()

/**
 * 콜백 기반 구현의 특징:
 *
 * 1. Promise 없이 동작
 *    - 레거시 코드와 호환
 *    - 낮은 오버헤드
 *
 * 2. Zalgo 방지
 *    - 캐시 히트 시에도 setImmediate로 비동기 호출
 *    - 일관된 비동기 동작 보장
 *
 * 3. 콜백 배열 관리
 *    - Map에 콜백 배열 저장
 *    - 완료 시 모든 콜백에 결과 전달
 */
