/**
 * 08-cancel-basic.js
 * 비동기 작업 취소 - 기본 패턴
 *
 * cancelRequested 플래그를 사용한 취소 구현
 */

// 커스텀 취소 에러
class CancelError extends Error {
  constructor(message = 'Operation cancelled') {
    super(message)
    this.name = 'CancelError'
  }
}

// 비동기 작업 시뮬레이션
async function asyncStep(name, durationMs) {
  console.log(`[Step] Starting: ${name}`)
  await new Promise(resolve => setTimeout(resolve, durationMs))
  console.log(`[Step] Completed: ${name}`)
  return `Result of ${name}`
}

// 취소 가능한 비동기 함수 (기본 패턴)
async function cancellableOperation(cancelObj) {
  const results = []

  // Step 1
  const res1 = await asyncStep('Step 1', 500)
  if (cancelObj.cancelRequested) {
    throw new CancelError('Cancelled after Step 1')
  }
  results.push(res1)

  // Step 2
  const res2 = await asyncStep('Step 2', 500)
  if (cancelObj.cancelRequested) {
    throw new CancelError('Cancelled after Step 2')
  }
  results.push(res2)

  // Step 3
  const res3 = await asyncStep('Step 3', 500)
  if (cancelObj.cancelRequested) {
    throw new CancelError('Cancelled after Step 3')
  }
  results.push(res3)

  return results
}

// 실행 예제
async function main() {
  console.log('=== Example 1: Complete without cancellation ===')
  const cancelObj1 = { cancelRequested: false }

  try {
    const results = await cancellableOperation(cancelObj1)
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Operation was cancelled:', err.message)
    } else {
      throw err
    }
  }

  console.log('\n=== Example 2: Cancel after 700ms ===')
  const cancelObj2 = { cancelRequested: false }

  // 700ms 후 취소 요청
  setTimeout(() => {
    console.log('[Main] Requesting cancellation...')
    cancelObj2.cancelRequested = true
  }, 700)

  try {
    const results = await cancellableOperation(cancelObj2)
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Operation was cancelled:', err.message)
    } else {
      throw err
    }
  }

  console.log('\n=== Example 3: Cancel before start ===')
  const cancelObj3 = { cancelRequested: true }

  try {
    const results = await cancellableOperation(cancelObj3)
    console.log('Results:', results)
  } catch (err) {
    if (err instanceof CancelError) {
      console.log('Operation was cancelled:', err.message)
    } else {
      throw err
    }
  }
}

main()

/**
 * 기본 패턴의 장단점:
 *
 * 장점:
 * - 간단하고 이해하기 쉬움
 * - 외부 라이브러리 불필요
 *
 * 단점:
 * - 매 단계마다 수동으로 체크 필요
 * - 코드 중복 발생
 * - 비동기 호출 진행 중에는 취소 불가
 */
