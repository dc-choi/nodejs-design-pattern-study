/**
 * 11-subset-sum-blocking.js
 * CPU 바운드 작업 - 이벤트 루프 차단 문제
 *
 * 부분집합 합계 문제 (Subset Sum Problem)
 * 주어진 집합에서 합이 특정 값이 되는 부분집합 찾기
 * 시간 복잡도: O(2^n) - NP-완전 문제
 */

// 부분집합 합계 문제 - 동기 버전 (이벤트 루프 차단)
class SubsetSumSync {
  constructor(set, sum) {
    this.set = set
    this.sum = sum
    this.results = []
  }

  // 재귀적으로 모든 조합 탐색
  _combine(set, subset) {
    for (let i = 0; i < set.length; i++) {
      const newSubset = subset.concat(set[i])
      const currentSum = newSubset.reduce((a, b) => a + b, 0)

      if (currentSum === this.sum) {
        this.results.push(newSubset)
      }

      // 남은 원소들로 계속 탐색
      this._combine(set.slice(i + 1), newSubset)
    }
  }

  run() {
    this._combine(this.set, [])
    return this.results
  }
}

// 이벤트 루프 차단 시연
async function demonstrateBlocking() {
  console.log('=== Event Loop Blocking Demo ===\n')

  // 작은 집합 테스트
  console.log('Small set (10 elements):')
  const smallSet = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const smallSum = 15

  const start1 = Date.now()
  const solver1 = new SubsetSumSync(smallSet, smallSum)
  const results1 = solver1.run()
  console.log(`Found ${results1.length} solutions in ${Date.now() - start1}ms`)
  console.log('Sample solutions:', results1.slice(0, 3))

  // 중간 크기 집합 테스트
  console.log('\nMedium set (20 elements):')
  const mediumSet = Array.from({ length: 20 }, (_, i) => i + 1)
  const mediumSum = 50

  const start2 = Date.now()
  const solver2 = new SubsetSumSync(mediumSet, mediumSum)
  const results2 = solver2.run()
  console.log(`Found ${results2.length} solutions in ${Date.now() - start2}ms`)

  // 이벤트 루프 차단 시연
  console.log('\n=== Demonstrating Event Loop Blocking ===')
  console.log('Starting computation...')

  // setInterval로 이벤트 루프 모니터링
  let ticks = 0
  const tickInterval = setInterval(() => {
    ticks++
    console.log(`[Tick ${ticks}] Event loop is running`)
  }, 100)

  // 큰 집합 계산 (이벤트 루프 차단)
  setTimeout(() => {
    console.log('\n[Compute] Starting heavy computation...')
    const heavySet = Array.from({ length: 22 }, (_, i) => i + 1)
    const heavySum = 100

    const start = Date.now()
    const solver = new SubsetSumSync(heavySet, heavySum)
    const results = solver.run()
    console.log(`[Compute] Done! Found ${results.length} solutions in ${Date.now() - start}ms`)
    console.log('[Compute] Notice how tick messages stopped during computation!')

    clearInterval(tickInterval)
  }, 500)

  // 2초 후 정리
  setTimeout(() => {
    console.log('\n[End] Demo complete')
  }, 10000)
}

demonstrateBlocking()

/**
 * 문제점:
 * - 동기 계산 중 이벤트 루프가 완전히 차단됨
 * - 타이머, I/O 콜백이 실행되지 않음
 * - HTTP 요청 처리 불가
 * - 서버가 응답하지 않는 것처럼 보임
 *
 * 해결책:
 * - setImmediate 인터리빙 (12-subset-sum-interleaving.js)
 * - 외부 프로세스 (13-process-pool.js)
 * - 작업자 스레드 (14-thread-pool.js)
 */
