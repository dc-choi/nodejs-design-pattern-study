/**
 * 07-cache-api.js
 * 비동기 요청 캐싱 (Caching)
 *
 * 배치 처리에 TTL 캐시를 추가하여 결과 재사용
 */

// 느린 API 시뮬레이션
async function slowApiCall(key) {
  console.log(`[API] Starting request for: ${key}`)
  await new Promise(resolve => setTimeout(resolve, 1000))
  console.log(`[API] Completed request for: ${key}`)
  return { key, data: `Result for ${key}`, timestamp: Date.now() }
}

// 캐시 + 배치 처리 래퍼
function createCachedApi(originalApi, ttlMs = 5000) {
  const runningRequests = new Map()  // 진행 중인 요청
  const cache = new Map()            // 완료된 결과 캐시

  return async function cachedApi(key) {
    // 1. 캐시 확인
    const cached = cache.get(key)
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < ttlMs) {
        console.log(`[Cache] HIT for ${key} (age: ${age}ms)`)
        return cached.value
      }
      // TTL 만료
      console.log(`[Cache] EXPIRED for ${key}`)
      cache.delete(key)
    }

    // 2. 진행 중인 요청 확인 (배치)
    if (runningRequests.has(key)) {
      console.log(`[Batch] Piggybacking on existing request: ${key}`)
      return runningRequests.get(key)
    }

    // 3. 새 요청 시작
    console.log(`[Cache] MISS for ${key}, starting new request`)
    const resultPromise = originalApi(key)
    runningRequests.set(key, resultPromise)

    try {
      const result = await resultPromise
      // 결과 캐시
      cache.set(key, {
        value: result,
        timestamp: Date.now()
      })
      return result
    } finally {
      runningRequests.delete(key)
    }
  }
}

// 캐시 무효화 기능 추가 버전
function createCachedApiWithInvalidation(originalApi, ttlMs = 5000) {
  const runningRequests = new Map()
  const cache = new Map()

  const cachedApi = async function(key) {
    const cached = cache.get(key)
    if (cached && (Date.now() - cached.timestamp) < ttlMs) {
      console.log(`[Cache] HIT for ${key}`)
      return cached.value
    }

    if (runningRequests.has(key)) {
      return runningRequests.get(key)
    }

    const resultPromise = originalApi(key)
    runningRequests.set(key, resultPromise)

    try {
      const result = await resultPromise
      cache.set(key, { value: result, timestamp: Date.now() })
      return result
    } finally {
      runningRequests.delete(key)
    }
  }

  // 캐시 무효화 메서드
  cachedApi.invalidate = (key) => {
    console.log(`[Cache] Invalidating: ${key}`)
    cache.delete(key)
  }

  cachedApi.invalidateAll = () => {
    console.log(`[Cache] Invalidating all entries`)
    cache.clear()
  }

  cachedApi.getStats = () => ({
    cacheSize: cache.size,
    runningRequests: runningRequests.size
  })

  return cachedApi
}

// 캐시가 적용된 API
const cachedApiCall = createCachedApi(slowApiCall, 3000)

async function main() {
  console.log('=== First Call (Cache MISS) ===')
  const start1 = Date.now()
  const result1 = await cachedApiCall('user:1')
  console.log(`Time: ${Date.now() - start1}ms\n`)

  console.log('=== Second Call (Cache HIT) ===')
  const start2 = Date.now()
  const result2 = await cachedApiCall('user:1')
  console.log(`Time: ${Date.now() - start2}ms\n`)

  console.log('=== Concurrent Calls (Batch + Cache) ===')
  const start3 = Date.now()
  const results = await Promise.all([
    cachedApiCall('user:2'),
    cachedApiCall('user:2'),
    cachedApiCall('user:2')
  ])
  console.log(`Time: ${Date.now() - start3}ms\n`)

  console.log('=== After TTL Expiry ===')
  console.log('Waiting 4 seconds...')
  await new Promise(resolve => setTimeout(resolve, 4000))
  const start4 = Date.now()
  await cachedApiCall('user:1')
  console.log(`Time: ${Date.now() - start4}ms`)
}

main()

/**
 * 캐싱 고려사항:
 * - TTL 설정: 데이터 특성에 맞는 적절한 만료 시간
 * - 메모리 관리: LRU 알고리즘으로 오래된 항목 제거
 * - 무효화 전략: 데이터 변경 시 캐시 동기화
 * - 분산 캐시: 여러 서버 간 캐시 공유 (Redis 등)
 */
