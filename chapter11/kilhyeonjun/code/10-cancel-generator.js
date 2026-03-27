/**
 * 10-cancel-generator.js
 * 비동기 작업 취소 - 제너레이터 패턴
 *
 * 제너레이터를 사용하여 자동으로 취소 포인트 생성
 */

// 커스텀 취소 에러
class CancelError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message)
    this.name = 'CancelError'
  }
}

// 제너레이터 기반 취소 가능한 비동기 함수 생성
function createAsyncCancelable(generatorFn) {
  return function(...args) {
    const generator = generatorFn(...args)
    let cancelRequested = false

    function cancel() {
      cancelRequested = true
    }

    const promise = new Promise((resolve, reject) => {
      async function step(nextValue) {
        // 취소 요청 확인
        if (cancelRequested) {
          return reject(new CancelError())
        }

        let result
        try {
          result = generator.next(nextValue)
        } catch (err) {
          return reject(err)
        }

        if (result.done) {
          return resolve(result.value)
        }

        try {
          // Promise 대기 후 다음 단계
          const value = await result.value
          step(value)
        } catch (err) {
          try {
            // 에러를 제너레이터에 전달
            result = generator.throw(err)
            if (result.done) {
              return resolve(result.value)
            }
            step(result.value)
          } catch (thrownErr) {
            reject(thrownErr)
          }
        }
      }

      step()
    })

    return { promise, cancel }
  }
}

// 비동기 작업 시뮬레이션
async function asyncStep(name, durationMs) {
  console.log(`[Step] Starting: ${name}`)
  await new Promise(resolve => setTimeout(resolve, durationMs))
  console.log(`[Step] Completed: ${name}`)
  return `Result of ${name}`
}

// 제너레이터 함수로 비동기 로직 정의
const cancellableOperation = createAsyncCancelable(function* () {
  const results = []

  // yield로 비동기 작업 실행 - 각 yield가 취소 포인트
  results.push(yield asyncStep('Step 1', 500))
  results.push(yield asyncStep('Step 2', 500))
  results.push(yield asyncStep('Step 3', 500))

  return results
})

// 더 복잡한 예제
const complexOperation = createAsyncCancelable(function* () {
  console.log('[Complex] Starting complex operation')

  const user = yield asyncStep('Fetch User', 300)
  console.log('[Complex] Got user:', user)

  const orders = yield asyncStep('Fetch Orders', 300)
  console.log('[Complex] Got orders:', orders)

  // 조건부 로직도 가능
  if (orders) {
    const details = yield asyncStep('Fetch Details', 300)
    console.log('[Complex] Got details:', details)
  }

  return { user, orders }
})

async function main() {
  console.log('=== Example 1: Complete without cancellation ===')
  const { promise: promise1, cancel: cancel1 } = cancellableOperation()

  try {
    const results = await promise1
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Cancelled:', err.message)
    } else {
      throw err
    }
  }

  console.log('\n=== Example 2: Cancel during operation ===')
  const { promise: promise2, cancel: cancel2 } = cancellableOperation()

  setTimeout(() => {
    console.log('[Main] Cancelling...')
    cancel2()
  }, 700)

  try {
    const results = await promise2
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Cancelled:', err.message)
    } else {
      throw err
    }
  }

  console.log('\n=== Example 3: Complex operation ===')
  const { promise: promise3, cancel: cancel3 } = complexOperation()

  setTimeout(() => {
    console.log('[Main] Cancelling complex operation...')
    cancel3()
  }, 500)

  try {
    const results = await promise3
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
 * 제너레이터 패턴의 장단점:
 *
 * 장점:
 * - 모든 yield가 자동으로 취소 포인트
 * - 비즈니스 로직에 취소 코드 없음
 * - 가독성이 좋음
 *
 * 단점:
 * - 제너레이터 문법 이해 필요
 * - 약간의 성능 오버헤드
 *
 * 참고: caf 라이브러리가 이 패턴을 구현
 * https://github.com/getify/CAF
 */
