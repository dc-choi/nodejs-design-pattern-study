/**
 * 11.4-computing-farm.js
 * 연습문제 11.4: 컴퓨팅 팜
 *
 * HTTP로 작업을 분산하고 vm 모듈로 동적 코드를 실행하는
 * 분산 컴퓨팅 시스템 구현
 */

import { createServer } from 'http'
import { request as httpRequest } from 'http'
import vm from 'vm'

// ============================================
// Worker Node (작업자 노드)
// ============================================

class WorkerNode {
  constructor(port) {
    this.port = port
    this.taskCount = 0
    this.server = null
  }

  start() {
    this.server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/execute') {
        this._handleExecute(req, res)
      } else if (req.method === 'GET' && req.url === '/status') {
        this._handleStatus(req, res)
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    this.server.listen(this.port, () => {
      console.log(`[Worker] Listening on port ${this.port}`)
    })
  }

  async _handleExecute(req, res) {
    let body = ''
    for await (const chunk of req) {
      body += chunk
    }

    try {
      const { code, context = {} } = JSON.parse(body)
      this.taskCount++

      console.log(`[Worker:${this.port}] Executing task #${this.taskCount}`)
      const startTime = Date.now()

      // vm으로 안전하게 코드 실행
      const result = await this._executeCode(code, context)
      const duration = Date.now() - startTime

      console.log(`[Worker:${this.port}] Task completed in ${duration}ms`)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        result,
        duration,
        worker: this.port
      }))
    } catch (error) {
      console.error(`[Worker:${this.port}] Error:`, error.message)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        worker: this.port
      }))
    }
  }

  _handleStatus(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      port: this.port,
      taskCount: this.taskCount,
      uptime: process.uptime()
    }))
  }

  async _executeCode(code, contextData) {
    // 샌드박스 컨텍스트 생성
    const sandbox = {
      console: {
        log: (...args) => console.log(`[Sandbox]`, ...args)
      },
      setTimeout,
      Promise,
      Array,
      Object,
      Math,
      JSON,
      ...contextData,
      result: undefined
    }

    // 컨텍스트 생성
    const context = vm.createContext(sandbox)

    // 타임아웃과 함께 코드 실행
    const script = new vm.Script(`
      (async () => {
        ${code}
      })()
    `)

    const result = await script.runInContext(context, {
      timeout: 5000  // 5초 타임아웃
    })

    return result
  }

  stop() {
    if (this.server) {
      this.server.close()
      console.log(`[Worker:${this.port}] Stopped`)
    }
  }
}

// ============================================
// Farm Coordinator (팜 코디네이터)
// ============================================

class FarmCoordinator {
  constructor(workerPorts) {
    this.workers = workerPorts.map(port => ({
      port,
      host: 'localhost',
      busy: false,
      taskCount: 0
    }))
    this.taskQueue = []
    this.roundRobinIndex = 0
  }

  // 라운드 로빈 방식으로 워커 선택
  _selectWorker() {
    const availableWorkers = this.workers.filter(w => !w.busy)
    if (availableWorkers.length === 0) {
      return null
    }

    this.roundRobinIndex = (this.roundRobinIndex + 1) % availableWorkers.length
    return availableWorkers[this.roundRobinIndex]
  }

  // 가장 적게 사용된 워커 선택
  _selectLeastBusyWorker() {
    const availableWorkers = this.workers.filter(w => !w.busy)
    if (availableWorkers.length === 0) {
      return null
    }

    return availableWorkers.reduce((min, w) =>
      w.taskCount < min.taskCount ? w : min
    )
  }

  // 작업 실행
  async execute(code, context = {}) {
    const worker = this._selectLeastBusyWorker()

    if (!worker) {
      // 모든 워커가 바쁘면 큐에 저장
      return new Promise((resolve, reject) => {
        this.taskQueue.push({ code, context, resolve, reject })
      })
    }

    worker.busy = true
    worker.taskCount++

    try {
      const result = await this._sendToWorker(worker, code, context)
      return result
    } finally {
      worker.busy = false
      this._processQueue()
    }
  }

  // 큐 처리
  _processQueue() {
    if (this.taskQueue.length === 0) return

    const worker = this._selectLeastBusyWorker()
    if (!worker) return

    const task = this.taskQueue.shift()
    this.execute(task.code, task.context)
      .then(task.resolve)
      .catch(task.reject)
  }

  // HTTP로 워커에 작업 전송
  _sendToWorker(worker, code, context) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ code, context })

      const req = httpRequest({
        hostname: worker.host,
        port: worker.port,
        path: '/execute',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          try {
            const result = JSON.parse(body)
            if (result.success) {
              resolve(result)
            } else {
              reject(new Error(result.error))
            }
          } catch (e) {
            reject(e)
          }
        })
      })

      req.on('error', reject)
      req.write(data)
      req.end()
    })
  }

  // 병렬 실행
  async executeParallel(tasks) {
    return Promise.all(
      tasks.map(task => this.execute(task.code, task.context))
    )
  }

  // 맵-리듀스 실행
  async mapReduce(data, mapCode, reduceCode) {
    // Map 단계: 각 데이터 청크를 병렬 처리
    const chunks = this._splitArray(data, this.workers.length)
    const mapTasks = chunks.map(chunk => ({
      code: mapCode,
      context: { data: chunk }
    }))

    console.log(`[Farm] Map phase: ${mapTasks.length} tasks`)
    const mapResults = await this.executeParallel(mapTasks)

    // Reduce 단계: 결과 합치기
    console.log(`[Farm] Reduce phase`)
    const reduceResult = await this.execute(reduceCode, {
      results: mapResults.map(r => r.result)
    })

    return reduceResult
  }

  _splitArray(arr, n) {
    const chunks = []
    const chunkSize = Math.ceil(arr.length / n)
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push(arr.slice(i, i + chunkSize))
    }
    return chunks
  }

  // 상태 조회
  async getStatus() {
    const statuses = await Promise.all(
      this.workers.map(w =>
        new Promise((resolve) => {
          const req = httpRequest({
            hostname: w.host,
            port: w.port,
            path: '/status',
            method: 'GET'
          }, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => {
              try {
                resolve(JSON.parse(body))
              } catch {
                resolve({ port: w.port, error: 'Parse error' })
              }
            })
          })
          req.on('error', () => resolve({ port: w.port, error: 'Unreachable' }))
          req.end()
        })
      )
    )
    return statuses
  }
}

// ============================================
// 데모 실행
// ============================================

async function main() {
  console.log('=== Computing Farm Demo ===\n')

  // 워커 노드 시작
  const workerPorts = [3001, 3002, 3003]
  const workers = workerPorts.map(port => new WorkerNode(port))
  workers.forEach(w => w.start())

  // 워커가 시작될 때까지 대기
  await new Promise(resolve => setTimeout(resolve, 500))

  // 팜 코디네이터 생성
  const farm = new FarmCoordinator(workerPorts)

  try {
    // 1. 단순 작업 실행
    console.log('\n--- Test 1: Simple execution ---')
    const result1 = await farm.execute(`
      const sum = Array.from({ length: 100 }, (_, i) => i + 1)
        .reduce((a, b) => a + b, 0);
      return sum;
    `)
    console.log('Result:', result1)

    // 2. 컨텍스트와 함께 실행
    console.log('\n--- Test 2: With context ---')
    const result2 = await farm.execute(`
      const doubled = numbers.map(n => n * multiplier);
      return doubled;
    `, {
      numbers: [1, 2, 3, 4, 5],
      multiplier: 10
    })
    console.log('Result:', result2)

    // 3. 병렬 실행
    console.log('\n--- Test 3: Parallel execution ---')
    const tasks = [
      { code: 'return "Task A: " + Math.random()' },
      { code: 'return "Task B: " + Math.random()' },
      { code: 'return "Task C: " + Math.random()' }
    ]
    const results = await farm.executeParallel(tasks)
    console.log('Results:', results.map(r => r.result))

    // 4. Map-Reduce
    console.log('\n--- Test 4: Map-Reduce ---')
    const data = Array.from({ length: 100 }, (_, i) => i + 1)

    const mapResult = await farm.mapReduce(
      data,
      // Map: 각 청크의 합계
      `return data.reduce((a, b) => a + b, 0)`,
      // Reduce: 모든 합계의 합
      `return results.reduce((a, b) => a + b, 0)`
    )
    console.log('Map-Reduce result:', mapResult.result)
    console.log('Expected:', data.reduce((a, b) => a + b, 0))

    // 5. 상태 확인
    console.log('\n--- Worker Status ---')
    const status = await farm.getStatus()
    console.log(status)

  } finally {
    // 정리
    workers.forEach(w => w.stop())
  }
}

main().catch(console.error)

/**
 * 컴퓨팅 팜의 특징:
 *
 * 1. HTTP 기반 분산
 *    - 워커 노드가 HTTP 서버로 동작
 *    - 네트워크를 통한 작업 분배
 *    - 언어/플랫폼 독립적 확장 가능
 *
 * 2. vm 기반 안전한 실행
 *    - 샌드박스 환경에서 코드 실행
 *    - 타임아웃 설정으로 무한 루프 방지
 *    - 제한된 API만 노출
 *
 * 3. 로드 밸런싱
 *    - 라운드 로빈 / 최소 사용 선택
 *    - 작업 큐로 과부하 방지
 *
 * 4. Map-Reduce 패턴
 *    - 대규모 데이터 병렬 처리
 *    - 자동 청크 분할
 *
 * 보안 주의사항:
 *    - 프로덕션에서는 더 엄격한 샌드박싱 필요
 *    - 인증/인가 추가 필요
 *    - 리소스 제한 (메모리, CPU) 필요
 */
