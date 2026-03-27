/**
 * 연습문제 13.3: 작업 중지 (Stop Workers)
 *
 * 일치 항목이 발견되면 모든 작업자 노드에서 계산을 중지하는 로직을 구현합니다.
 * 이 예제는 EventEmitter를 사용하여 분산 시스템의 동작을 시뮬레이션합니다.
 *
 * 핵심 개념:
 * - 브로드캐스트 메시지를 통한 작업 중지 신호 전파
 * - 각 작업자가 중지 신호를 수신하고 처리하는 로직
 * - 작업 완료 또는 중지 상태 관리
 */

import { EventEmitter } from 'events'

/**
 * 작업자 노드 시뮬레이션
 * 해시썸 크래커의 작업자를 간단화하여 구현
 */
class Worker extends EventEmitter {
  constructor(id, messageBus) {
    super()
    this.id = id
    this.messageBus = messageBus
    this.isRunning = false
    this.isStopped = false  // 전역 중지 상태
    this.currentTask = null

    // 중지 신호 수신 리스너
    this.messageBus.on('stop', () => {
      this._handleStop()
    })

    // 새 작업 수신 리스너
    this.messageBus.on(`task:${this.id}`, (task) => {
      // 이미 중지 상태면 작업 거부
      if (this.isStopped) {
        console.log(`[Worker ${this.id}] 중지 상태 - 작업 거부`)
        return
      }
      this._processTask(task)
    })
  }

  /**
   * 중지 신호 처리
   * @private
   */
  _handleStop() {
    this.isStopped = true  // 전역 중지 상태 설정
    if (this.isRunning) {
      console.log(`[Worker ${this.id}] 중지 신호 수신, 작업 중단`)
      this.isRunning = false
      this.currentTask = null
      this.emit('stopped')
    }
  }

  /**
   * 작업 처리 시뮬레이션
   * @param {Object} task - 처리할 작업
   * @private
   */
  async _processTask(task) {
    this.isRunning = true
    this.currentTask = task
    console.log(`[Worker ${this.id}] 작업 시작: ${JSON.stringify(task)}`)

    // 작업 처리 시뮬레이션 (100ms 단위로 체크)
    const startRange = task.startRange
    const endRange = task.endRange
    const targetHash = task.targetHash

    for (let i = startRange; i <= endRange && this.isRunning; i++) {
      // 매 100번째 반복마다 이벤트 루프에 제어권 양보
      if (i % 100 === 0) {
        await new Promise((resolve) => setImmediate(resolve))
      }

      // 일치 여부 확인 (시뮬레이션)
      const hash = this._computeHash(i)
      if (hash === targetHash) {
        console.log(`[Worker ${this.id}] 일치 항목 발견: ${i}`)

        // 결과 보고 및 전체 중지 신호 발송
        this.messageBus.emit('match-found', {
          workerId: this.id,
          value: i,
          hash
        })

        // 전체 작업자에게 중지 신호 브로드캐스트
        this.messageBus.emit('stop')
        return
      }
    }

    if (this.isRunning) {
      console.log(`[Worker ${this.id}] 작업 완료, 일치 항목 없음`)
      this.isRunning = false
      this.emit('completed')
    }
  }

  /**
   * 해시 계산 시뮬레이션
   * @param {number} value - 해시할 값
   * @returns {string} 해시 값
   * @private
   */
  _computeHash(value) {
    // 실제로는 crypto.createHash 사용
    // 여기서는 간단한 시뮬레이션
    return `hash_${value % 1000}`
  }
}

/**
 * 코디네이터 노드
 * 작업을 분배하고 결과를 수집
 */
class Coordinator {
  constructor(messageBus, workerCount) {
    this.messageBus = messageBus
    this.workerCount = workerCount
    this.result = null
    this.isComplete = false

    // 일치 항목 발견 리스너
    this.messageBus.on('match-found', (result) => {
      this._handleMatchFound(result)
    })
  }

  /**
   * 일치 항목 발견 처리
   * @param {Object} result - 발견된 결과
   * @private
   */
  _handleMatchFound(result) {
    if (!this.isComplete) {
      this.isComplete = true
      this.result = result
      console.log(`[Coordinator] 일치 항목 수신: Worker ${result.workerId}에서 ${result.value} 발견`)
    }
  }

  /**
   * 작업 분배
   * @param {string} targetHash - 찾을 해시
   * @param {number} totalRange - 전체 검색 범위
   */
  distributeWork(targetHash, totalRange) {
    const rangePerWorker = Math.ceil(totalRange / this.workerCount)

    for (let i = 0; i < this.workerCount; i++) {
      const startRange = i * rangePerWorker
      const endRange = Math.min((i + 1) * rangePerWorker - 1, totalRange - 1)

      console.log(`[Coordinator] Worker ${i}에 작업 할당: ${startRange} ~ ${endRange}`)

      this.messageBus.emit(`task:${i}`, {
        targetHash,
        startRange,
        endRange
      })
    }
  }
}

// 예제 실행
async function main() {
  console.log('=== 연습문제 13.3: 작업 중지 패턴 ===\n')

  // 메시지 버스 (실제로는 Redis Pub/Sub, ZeroMQ 등)
  const messageBus = new EventEmitter()

  // 작업자 수
  const WORKER_COUNT = 3

  // 작업자 생성
  const workers = []
  for (let i = 0; i < WORKER_COUNT; i++) {
    workers.push(new Worker(i, messageBus))
  }

  // 코디네이터 생성
  const coordinator = new Coordinator(messageBus, WORKER_COUNT)

  // 검색할 대상 해시 (hash_350 = 350 % 1000)
  const targetHash = 'hash_350'
  const totalRange = 1000

  console.log(`대상 해시: ${targetHash}`)
  console.log(`검색 범위: 0 ~ ${totalRange - 1}`)
  console.log(`작업자 수: ${WORKER_COUNT}\n`)

  // 결과 대기 Promise 설정 (작업 분배 전에 리스너 등록)
  const resultPromise = new Promise((resolve) => {
    messageBus.once('stop', () => {
      // 모든 작업자가 중지될 시간을 줌
      setTimeout(() => {
        console.log('\n=== 최종 결과 ===')
        if (coordinator.result) {
          console.log(`발견된 값: ${coordinator.result.value}`)
          console.log(`발견한 작업자: Worker ${coordinator.result.workerId}`)
        }
        resolve()
      }, 100)
    })
  })

  // 작업 분배 시작
  coordinator.distributeWork(targetHash, totalRange)

  // 결과 대기
  await resultPromise
}

main().catch(console.error)

/*
핵심 포인트:
1. 메시지 버스를 통한 브로드캐스트 'stop' 이벤트
2. 각 작업자는 isRunning 플래그로 상태 관리
3. 일치 항목 발견 시 즉시 전체 중지 신호 발송
4. 비동기 루프에서 주기적으로 이벤트 루프에 제어권 양보 (setImmediate)
5. 코디네이터가 결과를 수집하고 최종 상태 관리
*/
