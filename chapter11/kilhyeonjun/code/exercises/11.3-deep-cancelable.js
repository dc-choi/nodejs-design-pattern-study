/**
 * 11.3-deep-cancelable.js
 * 연습문제 11.3: Deep 취소 가능한 비동기 함수
 *
 * 중첩된 취소 가능 함수에서 루트 함수 취소 시
 * 모든 중첩 함수까지 취소되는 기능 구현
 */

// 취소 에러
class CancelError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message)
    this.name = 'CancelError'
  }
}

/**
 * Deep 취소 가능한 비동기 함수 생성기
 *
 * 취소 컨텍스트를 자식 함수에 전파하여
 * 중첩된 모든 함수가 취소될 수 있도록 함
 */
class CancelContext {
  constructor(parent = null) {
    this.parent = parent
    this.children = new Set()
    this.cancelRequested = false
    this.cancelCallbacks = new Set()

    // 부모에 등록
    if (parent) {
      parent.children.add(this)
      // 부모가 이미 취소됐으면 자식도 취소
      if (parent.cancelRequested) {
        this.cancelRequested = true
      }
    }
  }

  // 취소 요청
  cancel() {
    if (this.cancelRequested) return

    this.cancelRequested = true
    console.log(`[Cancel] Context cancelled, propagating to ${this.children.size} children`)

    // 콜백 실행
    this.cancelCallbacks.forEach(cb => cb())

    // 자식들도 취소
    this.children.forEach(child => child.cancel())
  }

  // 취소 콜백 등록
  onCancel(callback) {
    if (this.cancelRequested) {
      callback()
      return
    }
    this.cancelCallbacks.add(callback)
    return () => this.cancelCallbacks.delete(callback)
  }

  // 취소 확인
  throwIfCancelled() {
    if (this.cancelRequested) {
      throw new CancelError()
    }
  }

  // 자식 컨텍스트 생성
  createChild() {
    return new CancelContext(this)
  }

  // 정리
  cleanup() {
    if (this.parent) {
      this.parent.children.delete(this)
    }
  }
}

/**
 * Deep 취소 가능한 비동기 함수 래퍼
 */
function createDeepCancelable(asyncFn) {
  return function(ctx = new CancelContext()) {
    const promise = (async () => {
      try {
        return await asyncFn(ctx)
      } finally {
        ctx.cleanup()
      }
    })()

    return {
      promise,
      cancel: () => ctx.cancel(),
      context: ctx
    }
  }
}

// 비동기 작업 시뮬레이션
async function delay(ms, ctx) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)

    // 취소 시 타이머 정리
    ctx.onCancel(() => {
      clearTimeout(timer)
      reject(new CancelError())
    })
  })
}

// 예제: 중첩된 취소 가능 함수들
const innerOperation = createDeepCancelable(async (ctx) => {
  console.log('[Inner] Starting...')
  ctx.throwIfCancelled()

  await delay(300, ctx)
  console.log('[Inner] Step 1 done')

  ctx.throwIfCancelled()
  await delay(300, ctx)
  console.log('[Inner] Step 2 done')

  return 'Inner result'
})

const middleOperation = createDeepCancelable(async (ctx) => {
  console.log('[Middle] Starting...')
  ctx.throwIfCancelled()

  await delay(200, ctx)
  console.log('[Middle] Step 1 done')

  // 자식 컨텍스트로 내부 작업 호출
  const childCtx = ctx.createChild()
  const { promise: innerPromise } = innerOperation(childCtx)
  const innerResult = await innerPromise
  console.log('[Middle] Inner result:', innerResult)

  ctx.throwIfCancelled()
  await delay(200, ctx)
  console.log('[Middle] Step 2 done')

  return 'Middle result'
})

const outerOperation = createDeepCancelable(async (ctx) => {
  console.log('[Outer] Starting...')
  ctx.throwIfCancelled()

  await delay(100, ctx)
  console.log('[Outer] Step 1 done')

  // 자식 컨텍스트로 중간 작업 호출
  const childCtx = ctx.createChild()
  const { promise: middlePromise } = middleOperation(childCtx)
  const middleResult = await middlePromise
  console.log('[Outer] Middle result:', middleResult)

  ctx.throwIfCancelled()
  await delay(100, ctx)
  console.log('[Outer] Step 2 done')

  return 'Outer result'
})

// 테스트
async function main() {
  console.log('=== Deep Cancelable Demo ===\n')

  // Test 1: 정상 완료
  console.log('--- Test 1: Normal completion ---')
  try {
    const { promise, cancel, context } = outerOperation()
    const result = await promise
    console.log('Final result:', result)
  } catch (err) {
    console.log('Error:', err.message)
  }

  console.log('\n--- Test 2: Cancel from root (after 500ms) ---')
  try {
    const { promise, cancel, context } = outerOperation()

    // 500ms 후 취소 (Inner 실행 중에 취소됨)
    setTimeout(() => {
      console.log('\n[Main] Requesting cancellation...')
      cancel()
    }, 500)

    const result = await promise
    console.log('Final result:', result)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('[Main] Operation was cancelled successfully')
    } else {
      throw err
    }
  }

  console.log('\n--- Test 3: Cancel immediately ---')
  try {
    const { promise, cancel } = outerOperation()

    // 즉시 취소
    cancel()

    const result = await promise
    console.log('Final result:', result)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('[Main] Immediate cancellation worked')
    } else {
      throw err
    }
  }

  // Test 4: 병렬 중첩 작업
  console.log('\n--- Test 4: Parallel nested operations ---')

  const parallelOperation = createDeepCancelable(async (ctx) => {
    console.log('[Parallel] Starting 3 concurrent tasks...')

    const child1 = ctx.createChild()
    const child2 = ctx.createChild()
    const child3 = ctx.createChild()

    const results = await Promise.all([
      innerOperation(child1).promise.catch(e => `Task 1: ${e.message}`),
      innerOperation(child2).promise.catch(e => `Task 2: ${e.message}`),
      innerOperation(child3).promise.catch(e => `Task 3: ${e.message}`)
    ])

    return results
  })

  try {
    const { promise, cancel } = parallelOperation()

    setTimeout(() => {
      console.log('\n[Main] Cancelling parallel operations...')
      cancel()
    }, 400)

    const result = await promise
    console.log('Parallel results:', result)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('[Main] Parallel operation cancelled')
    } else {
      throw err
    }
  }
}

main().catch(console.error)

/**
 * Deep 취소의 핵심:
 *
 * 1. CancelContext 계층 구조
 *    - 부모-자식 관계로 컨텍스트 연결
 *    - 부모 취소 시 모든 자식에게 전파
 *
 * 2. 취소 콜백
 *    - 진행 중인 비동기 작업(타이머, fetch 등) 정리
 *    - 리소스 누수 방지
 *
 * 3. 명시적 취소 확인
 *    - throwIfCancelled()로 취소 포인트 생성
 *    - 각 단계에서 취소 확인
 *
 * 확장 가능:
 *    - AbortController와 통합
 *    - 취소 이유 전달
 *    - 부분 취소 (특정 자식만)
 */
