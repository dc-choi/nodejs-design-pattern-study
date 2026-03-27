/**
 * 12-subset-sum-interleaving.js
 * CPU 바운드 작업 - setImmediate 인터리빙
 *
 * setImmediate()를 사용하여 계산 단계 사이에
 * 다른 I/O 작업이 실행될 수 있게 함
 */

import { EventEmitter } from 'events'

// 부분집합 합계 문제 - 인터리빙 버전
class SubsetSumInterleaved extends EventEmitter {
  constructor(set, sum) {
    super()
    this.set = set
    this.sum = sum
    this.results = []
    this.iterations = 0
  }

  _combineInterleaved(set, subset, callback) {
    this.iterations++

    // 주기적으로 진행 상황 이벤트 발생
    if (this.iterations % 10000 === 0) {
      this.emit('progress', {
        iterations: this.iterations,
        results: this.results.length
      })
    }

    // setImmediate를 사용하여 다른 작업에 양보
    setImmediate(() => {
      if (set.length === 0) {
        return callback()
      }

      // 현재 원소를 포함하는 경우 처리
      const currentElement = set[0]
      const remaining = set.slice(1)
      const newSubset = subset.concat(currentElement)
      const currentSum = newSubset.reduce((a, b) => a + b, 0)

      if (currentSum === this.sum) {
        this.results.push(newSubset)
        this.emit('match', newSubset)
      }

      // 현재 원소를 포함하는 분기
      this._combineInterleaved(remaining, newSubset, () => {
        // 현재 원소를 제외하는 분기
        this._combineInterleaved(remaining, subset, callback)
      })
    })
  }

  run(callback) {
    const startTime = Date.now()
    this._combineInterleaved(this.set, [], () => {
      const duration = Date.now() - startTime
      callback(null, {
        results: this.results,
        iterations: this.iterations,
        duration
      })
    })
  }

  // Promise 버전
  runAsync() {
    return new Promise((resolve, reject) => {
      this.run((err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  }
}

// 이벤트 루프가 차단되지 않음을 시연
async function demonstrateInterleaving() {
  console.log('=== setImmediate Interleaving Demo ===\n')

  const set = Array.from({ length: 18 }, (_, i) => i + 1)
  const sum = 50

  console.log(`Finding subsets of [1..${set.length}] that sum to ${sum}`)
  console.log('Notice how tick messages continue during computation!\n')

  // 이벤트 루프 모니터링
  let ticks = 0
  const tickInterval = setInterval(() => {
    ticks++
    console.log(`[Tick ${ticks}] Event loop is responsive`)
  }, 200)

  // 인터리빙 계산 실행
  const solver = new SubsetSumInterleaved(set, sum)

  // 진행 상황 이벤트 리스너
  solver.on('progress', ({ iterations, results }) => {
    console.log(`[Progress] Iterations: ${iterations}, Found: ${results} solutions`)
  })

  // 결과 찾을 때마다 이벤트
  let matchCount = 0
  solver.on('match', (subset) => {
    matchCount++
    if (matchCount <= 3) {
      console.log(`[Match #${matchCount}] ${JSON.stringify(subset)}`)
    }
  })

  try {
    const result = await solver.runAsync()
    console.log(`\n=== Computation Complete ===`)
    console.log(`Total solutions: ${result.results.length}`)
    console.log(`Total iterations: ${result.iterations}`)
    console.log(`Duration: ${result.duration}ms`)
    console.log(`Ticks during computation: ${ticks}`)
  } finally {
    clearInterval(tickInterval)
  }
}

// 비교: 동기 vs 인터리빙
async function comparePerformance() {
  console.log('\n=== Performance Comparison ===\n')

  const set = Array.from({ length: 15 }, (_, i) => i + 1)
  const sum = 30

  // 인터리빙 버전
  console.log('Interleaved version:')
  const solver = new SubsetSumInterleaved(set, sum)
  const result = await solver.runAsync()
  console.log(`Found ${result.results.length} solutions in ${result.duration}ms`)

  console.log('\nNote: Interleaving has overhead but keeps event loop responsive')
}

demonstrateInterleaving().then(comparePerformance)

/**
 * setImmediate 인터리빙의 장단점:
 *
 * 장점:
 * - 이벤트 루프가 차단되지 않음
 * - 추가 프로세스/스레드 불필요
 * - 메모리 공유 가능
 *
 * 단점:
 * - 성능 오버헤드 (컨텍스트 스위칭)
 * - 단계가 길면 여전히 지연 발생
 * - 단일 코어만 사용
 *
 * 적합한 경우:
 * - 빠른 단계로 분할 가능한 작업
 * - 이벤트 루프 응답성이 중요한 경우
 * - 리소스가 제한된 환경
 */
