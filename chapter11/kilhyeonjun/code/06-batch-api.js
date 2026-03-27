/**
 * 06-batch-api.js
 * 비동기 요청 일괄 처리 (Batching)
 *
 * 동일한 요청이 진행 중일 때 새 요청을 시작하지 않고
 * 기존 요청에 편승(piggyback)
 */

// 느린 API 시뮬레이션
async function slowApiCall(key) {
  console.log(`[API] Starting request for: ${key}`)
  await new Promise(resolve => setTimeout(resolve, 1000))
  console.log(`[API] Completed request for: ${key}`)
  return { key, data: `Result for ${key}`, timestamp: Date.now() }
}

// 배치 처리 래퍼
function createBatchedApi(originalApi) {
  const runningRequests = new Map()

  return async function batchedApi(key) {
    // 동일한 요청이 진행 중이면 해당 Promise 반환
    if (runningRequests.has(key)) {
      console.log(`[Batch] Piggybacking on existing request: ${key}`)
      return runningRequests.get(key)
    }

    // 새 요청 시작
    console.log(`[Batch] Starting new request: ${key}`)
    const resultPromise = originalApi(key)
    runningRequests.set(key, resultPromise)

    // 요청 완료 시 Map에서 제거
    resultPromise.finally(() => {
      runningRequests.delete(key)
      console.log(`[Batch] Request completed and cleared: ${key}`)
    })

    return resultPromise
  }
}

// 배치 처리가 적용된 API
const batchedApiCall = createBatchedApi(slowApiCall)

async function main() {
  console.log('=== Without Batching ===')
  // 배치 없이 동일 요청 3번
  const start1 = Date.now()
  await Promise.all([
    slowApiCall('user:1'),
    slowApiCall('user:1'),
    slowApiCall('user:1')
  ])
  console.log(`Time without batching: ${Date.now() - start1}ms\n`)

  console.log('=== With Batching ===')
  // 배치 적용하여 동일 요청 3번
  const start2 = Date.now()
  await Promise.all([
    batchedApiCall('user:1'),
    batchedApiCall('user:1'),
    batchedApiCall('user:1')
  ])
  console.log(`Time with batching: ${Date.now() - start2}ms\n`)

  console.log('=== Different Keys ===')
  // 다른 키는 별도 요청
  const start3 = Date.now()
  await Promise.all([
    batchedApiCall('user:1'),
    batchedApiCall('user:2'),
    batchedApiCall('user:1')  // user:1과 배치됨
  ])
  console.log(`Time with different keys: ${Date.now() - start3}ms`)
}

main()

/**
 * 실행 결과:
 * - Without Batching: ~3000ms (3번 순차 실행)
 * - With Batching: ~1000ms (1번만 실행, 3명이 공유)
 * - Different Keys: ~1000ms (2개 병렬 실행)
 */
