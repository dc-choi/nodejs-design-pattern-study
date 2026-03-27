/**
 * 09-cancel-wrapper.js
 * 비동기 작업 취소 - 래퍼 패턴
 *
 * 비동기 호출을 래핑하여 취소 로직 재사용
 */

// 커스텀 취소 에러
class CancelError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message)
    this.name = 'CancelError'
  }
}

// 취소 가능한 래퍼 생성 팩토리
function createCancelWrapper() {
  let cancelRequested = false

  function cancel() {
    cancelRequested = true
  }

  // 비동기 함수를 래핑하는 함수
  function cancelWrapper(asyncFn, ...args) {
    if (cancelRequested) {
      return Promise.reject(new CancelError())
    }
    return asyncFn(...args)
  }

  return { cancel, cancelWrapper }
}

// 비동기 작업 시뮬레이션
async function asyncStep(name, durationMs) {
  console.log(`[Step] Starting: ${name}`)
  await new Promise(resolve => setTimeout(resolve, durationMs))
  console.log(`[Step] Completed: ${name}`)
  return `Result of ${name}`
}

// 취소 래퍼를 사용한 함수
async function operationWithWrapper(cancelWrapper) {
  const results = []

  // 각 비동기 호출을 래퍼로 감싸기
  results.push(await cancelWrapper(asyncStep, 'Step 1', 500))
  results.push(await cancelWrapper(asyncStep, 'Step 2', 500))
  results.push(await cancelWrapper(asyncStep, 'Step 3', 500))

  return results
}

// HTTP 요청 시뮬레이션
async function fetchData(url) {
  console.log(`[Fetch] Requesting: ${url}`)
  await new Promise(resolve => setTimeout(resolve, 300))
  console.log(`[Fetch] Received: ${url}`)
  return { url, data: 'response data' }
}

// 복잡한 작업 예제
async function complexOperation(cancelWrapper) {
  // 순차 요청
  const user = await cancelWrapper(fetchData, '/api/user')
  const orders = await cancelWrapper(fetchData, `/api/orders?user=${user.url}`)

  // 병렬 요청
  const [products, reviews] = await Promise.all([
    cancelWrapper(fetchData, '/api/products'),
    cancelWrapper(fetchData, '/api/reviews')
  ])

  return { user, orders, products, reviews }
}

async function main() {
  console.log('=== Example 1: Complete without cancellation ===')
  const { cancel: cancel1, cancelWrapper: wrapper1 } = createCancelWrapper()

  try {
    const results = await operationWithWrapper(wrapper1)
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Cancelled:', err.message)
    } else {
      throw err
    }
  }

  console.log('\n=== Example 2: Cancel during operation ===')
  const { cancel: cancel2, cancelWrapper: wrapper2 } = createCancelWrapper()

  setTimeout(() => {
    console.log('[Main] Cancelling...')
    cancel2()
  }, 700)

  try {
    const results = await operationWithWrapper(wrapper2)
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Cancelled:', err.message)
    } else {
      throw err
    }
  }

  console.log('\n=== Example 3: Complex operation with cancellation ===')
  const { cancel: cancel3, cancelWrapper: wrapper3 } = createCancelWrapper()

  setTimeout(() => {
    console.log('[Main] Cancelling complex operation...')
    cancel3()
  }, 500)

  try {
    const results = await complexOperation(wrapper3)
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Cancelled:', err.message)
    } else {
      throw err
    }
  }
}

main()

/**
 * 래퍼 패턴의 장단점:
 *
 * 장점:
 * - 취소 로직 재사용
 * - 코드가 더 깔끔함
 * - 기존 함수 수정 없이 적용 가능
 *
 * 단점:
 * - 모든 비동기 호출을 래핑해야 함
 * - 래핑을 잊으면 취소가 안됨
 */
