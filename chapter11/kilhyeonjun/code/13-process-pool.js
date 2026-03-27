/**
 * 13-process-pool.js
 * CPU 바운드 작업 - 외부 프로세스 풀
 *
 * child_process.fork()를 사용하여 작업을
 * 별도의 프로세스에서 실행
 */

import { fork } from 'child_process'
import { EventEmitter } from 'events'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 프로세스 풀 클래스
class ProcessPool extends EventEmitter {
  constructor(workerScript, poolSize) {
    super()
    this.workerScript = workerScript
    this.poolSize = poolSize
    this.workers = []
    this.freeWorkers = []
    this.queue = []

    // 워커 프로세스 생성
    for (let i = 0; i < poolSize; i++) {
      this._createWorker()
    }
  }

  _createWorker() {
    const worker = fork(this.workerScript)
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
      console.error(`[Worker ${worker.id}] Error:`, err)
      if (worker.currentTask) {
        worker.currentTask.reject(err)
      }
    })

    worker.on('exit', (code) => {
      console.log(`[Worker ${worker.id}] Exited with code ${code}`)
      // 필요시 워커 재생성 로직 추가
    })

    this.workers.push(worker)
    this.freeWorkers.push(worker)
    console.log(`[Pool] Created worker ${worker.id}`)
  }

  _processQueue() {
    if (this.queue.length === 0 || this.freeWorkers.length === 0) {
      return
    }

    const task = this.queue.shift()
    const worker = this.freeWorkers.shift()

    worker.currentTask = task
    worker.send({ type: 'task', data: task.data })
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
    console.log('[Pool] Shutting down...')
    for (const worker of this.workers) {
      worker.send({ type: 'shutdown' })
    }
    // 모든 워커가 종료될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 100))
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
  console.log('=== Process Pool Demo ===\n')

  // 워커 스크립트 경로
  const workerScript = join(__dirname, '13-process-worker.js')

  // 풀 생성 (CPU 코어 수에 맞춰 조정)
  const pool = new ProcessPool(workerScript, 4)
  console.log('')

  // 이벤트 루프 모니터링
  let ticks = 0
  const tickInterval = setInterval(() => {
    ticks++
    const stats = pool.getStats()
    console.log(`[Tick ${ticks}] Event loop responsive | Workers: ${stats.freeWorkers}/${stats.totalWorkers} free`)
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

  } finally {
    clearInterval(tickInterval)
    await pool.shutdown()
  }
}

main().catch(console.error)

/**
 * 외부 프로세스의 장단점:
 *
 * 장점:
 * - 이벤트 루프 완전 분리
 * - 멀티코어 활용
 * - 크래시 격리 (워커 크래시가 메인 프로세스에 영향 없음)
 *
 * 단점:
 * - 프로세스 생성 비용
 * - IPC 오버헤드
 * - 메모리 사용량 증가
 *
 * 적합한 경우:
 * - 장시간 실행되는 CPU 집약적 작업
 * - 멀티코어 활용이 필요한 경우
 * - 격리가 필요한 신뢰할 수 없는 코드 실행
 */
