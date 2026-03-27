/**
 * 14-thread-pool.js
 * CPU 바운드 작업 - 작업자 스레드 풀
 *
 * worker_threads를 사용하여 작업을
 * 별도의 스레드에서 실행
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { EventEmitter } from 'events'
import { fileURLToPath } from 'url'

// 워커 스레드 코드 (같은 파일에서 실행)
if (!isMainThread) {
  // 부분집합 합계 계산
  function subsetSum(set, sum) {
    const results = []

    function combine(remaining, subset) {
      for (let i = 0; i < remaining.length; i++) {
        const newSubset = subset.concat(remaining[i])
        const currentSum = newSubset.reduce((a, b) => a + b, 0)

        if (currentSum === sum) {
          results.push(newSubset)
        }

        combine(remaining.slice(i + 1), newSubset)
      }
    }

    combine(set, [])
    return results
  }

  // 메시지 처리
  parentPort.on('message', (msg) => {
    if (msg.type === 'task') {
      const { set, sum } = msg.data
      const startTime = Date.now()

      try {
        const results = subsetSum(set, sum)
        const duration = Date.now() - startTime

        parentPort.postMessage({
          type: 'result',
          data: {
            count: results.length,
            duration,
            sample: results.slice(0, 3)
          }
        })
      } catch (error) {
        parentPort.postMessage({
          type: 'result',
          error: error.message
        })
      }
    }
  })
} else {
  // 메인 스레드 코드

  // 스레드 풀 클래스
  class ThreadPool extends EventEmitter {
    constructor(poolSize) {
      super()
      this.poolSize = poolSize
      this.workers = []
      this.freeWorkers = []
      this.queue = []

      // 워커 스레드 생성
      for (let i = 0; i < poolSize; i++) {
        this._createWorker()
      }
    }

    _createWorker() {
      const worker = new Worker(fileURLToPath(import.meta.url))
      worker.id = this.workers.length

      worker.on('message', (msg) => {
        if (msg.type === 'result') {
          const { resolve, reject } = worker.currentTask
          worker.currentTask = null

          if (msg.error) {
            reject(new Error(msg.error))
          } else {
            resolve(msg.data)
          }

          // 워커를 다시 사용 가능 상태로
          this.freeWorkers.push(worker)
          this._processQueue()
        }
      })

      worker.on('error', (err) => {
        console.error(`[Thread ${worker.id}] Error:`, err)
        if (worker.currentTask) {
          worker.currentTask.reject(err)
        }
      })

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[Thread ${worker.id}] Exited with code ${code}`)
        }
      })

      this.workers.push(worker)
      this.freeWorkers.push(worker)
      console.log(`[Pool] Created thread ${worker.id}`)
    }

    _processQueue() {
      if (this.queue.length === 0 || this.freeWorkers.length === 0) {
        return
      }

      const task = this.queue.shift()
      const worker = this.freeWorkers.shift()

      worker.currentTask = task
      worker.postMessage({ type: 'task', data: task.data })
    }

    // 작업 실행
    run(taskData) {
      return new Promise((resolve, reject) => {
        const task = { data: taskData, resolve, reject }
        this.queue.push(task)
        this._processQueue()
      })
    }

    // 풀 종료
    async shutdown() {
      console.log('[Pool] Shutting down threads...')
      await Promise.all(
        this.workers.map(worker => worker.terminate())
      )
      console.log('[Pool] Shutdown complete')
    }

    // 상태 정보
    getStats() {
      return {
        totalWorkers: this.workers.length,
        freeWorkers: this.freeWorkers.length,
        queuedTasks: this.queue.length
      }
    }
  }

  // 메인 실행
  async function main() {
    console.log('=== Thread Pool Demo ===\n')

    // 풀 생성
    const pool = new ThreadPool(4)
    console.log('')

    // 이벤트 루프 모니터링
    let ticks = 0
    const tickInterval = setInterval(() => {
      ticks++
      const stats = pool.getStats()
      console.log(`[Tick ${ticks}] Event loop responsive | Threads: ${stats.freeWorkers}/${stats.totalWorkers} free`)
    }, 200)

    try {
      // 여러 작업 병렬 실행
      console.log('\n=== Running Multiple Tasks ===')
      const tasks = [
        { set: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], sum: 30 },
        { set: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], sum: 40 },
        { set: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19], sum: 35 },
        { set: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], sum: 100 }
      ]

      const startTime = Date.now()
      const results = await Promise.all(
        tasks.map(task => pool.run(task))
      )

      console.log(`\n=== Results ===`)
      results.forEach((result, i) => {
        console.log(`Task ${i + 1}: Found ${result.count} solutions in ${result.duration}ms`)
      })
      console.log(`Total time: ${Date.now() - startTime}ms (parallel execution)`)
      console.log(`Event loop ticks during execution: ${ticks}`)

      // 프로세스 풀과 비교
      console.log('\n=== Thread vs Process Comparison ===')
      console.log('Threads are lighter weight than processes:')
      console.log('- Faster startup time')
      console.log('- Lower memory overhead')
      console.log('- Can share memory via SharedArrayBuffer')

    } finally {
      clearInterval(tickInterval)
      await pool.shutdown()
    }
  }

  main().catch(console.error)
}

/**
 * 작업자 스레드의 장단점:
 *
 * 장점:
 * - 프로세스보다 가벼움
 * - 빠른 시작 시간
 * - SharedArrayBuffer로 메모리 공유 가능
 * - 이벤트 루프 완전 분리
 *
 * 단점:
 * - Node.js 10.5+ 필요
 * - 복잡한 에러 처리
 * - 공유 메모리 사용 시 동기화 필요
 *
 * 권장 라이브러리:
 * - workerpool: https://github.com/josdejong/workerpool
 * - piscina: https://github.com/piscinajs/piscina
 *
 * 적합한 경우:
 * - 빈번한 CPU 집약적 작업
 * - 메모리 공유가 필요한 경우
 * - 낮은 레이턴시가 중요한 경우
 */
