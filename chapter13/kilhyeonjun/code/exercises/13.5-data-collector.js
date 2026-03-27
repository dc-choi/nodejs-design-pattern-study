/**
 * 연습문제 13.5: 데이터 수집기 (Data Collector)
 *
 * 시스템에 연결된 모든 노드에 요청을 보내고
 * 모든 응답의 집계를 반환하는 추상화를 구현합니다.
 *
 * 핵심 개념:
 * - 게시/구독을 사용하여 모든 노드에 요청 브로드캐스트
 * - 단방향 채널을 통해 응답 수집
 * - 타임아웃 기반 집계 완료 또는 모든 노드 응답 대기
 */

import { EventEmitter } from 'events'

/**
 * 데이터 수집기
 * 모든 노드에 요청을 보내고 응답을 집계
 */
class DataCollector {
  constructor(messageBus, options = {}) {
    this.messageBus = messageBus
    this.timeout = options.timeout || 5000  // 기본 타임아웃 5초
    this.requestChannel = options.requestChannel || 'collector:request'
    this.responseChannel = options.responseChannel || 'collector:response'

    // 상관 식별자 -> 수집 상태 맵
    this.pendingCollections = new Map()

    // 응답 리스너 설정
    this.messageBus.on(this.responseChannel, (response) => {
      this._handleResponse(response)
    })
  }

  /**
   * ID 생성
   * @private
   */
  _generateId() {
    return Math.random().toString(36).substring(2, 15)
  }

  /**
   * 모든 노드에 요청을 보내고 응답 집계
   * @param {any} data - 요청 데이터
   * @param {Object} options - 옵션 (expectedNodes, timeout)
   * @returns {Promise<Array>} 집계된 응답 배열
   */
  collect(data, options = {}) {
    return new Promise((resolve, reject) => {
      const correlationId = this._generateId()
      const timeout = options.timeout || this.timeout
      const expectedNodes = options.expectedNodes || null  // null이면 타임아웃까지 대기

      console.log(`[Collector] 요청 발송 (ID: ${correlationId})`)

      // 수집 상태 초기화
      const collectionState = {
        responses: [],
        expectedNodes,
        resolve,
        reject,
        timeoutId: null
      }

      // 타임아웃 설정
      collectionState.timeoutId = setTimeout(() => {
        this._finalizeCollection(correlationId, false)
      }, timeout)

      this.pendingCollections.set(correlationId, collectionState)

      // 요청 브로드캐스트
      this.messageBus.emit(this.requestChannel, {
        correlationId,
        data,
        replyTo: this.responseChannel
      })
    })
  }

  /**
   * 응답 처리
   * @param {Object} response - 노드 응답
   * @private
   */
  _handleResponse(response) {
    const { correlationId, nodeId, data, error } = response
    const state = this.pendingCollections.get(correlationId)

    if (!state) {
      console.log(`[Collector] 알 수 없는 상관 ID: ${correlationId}`)
      return
    }

    console.log(`[Collector] 응답 수신 (Node: ${nodeId}, ID: ${correlationId})`)

    // 응답 저장
    state.responses.push({
      nodeId,
      data,
      error,
      timestamp: Date.now()
    })

    // 모든 예상 노드로부터 응답을 받았는지 확인
    if (state.expectedNodes && state.responses.length >= state.expectedNodes) {
      this._finalizeCollection(correlationId, true)
    }
  }

  /**
   * 수집 완료 처리
   * @param {string} correlationId - 상관 ID
   * @param {boolean} allReceived - 모든 응답 수신 여부
   * @private
   */
  _finalizeCollection(correlationId, allReceived) {
    const state = this.pendingCollections.get(correlationId)

    if (!state) return

    // 정리
    clearTimeout(state.timeoutId)
    this.pendingCollections.delete(correlationId)

    if (allReceived) {
      console.log(`[Collector] 수집 완료 (ID: ${correlationId}) - 모든 응답 수신`)
    } else {
      console.log(`[Collector] 수집 완료 (ID: ${correlationId}) - 타임아웃`)
    }

    // 결과 반환
    state.resolve({
      correlationId,
      allReceived,
      responses: state.responses,
      totalCount: state.responses.length
    })
  }
}

/**
 * 데이터 노드 시뮬레이션
 * 요청을 받고 자신의 데이터를 응답
 */
class DataNode {
  constructor(nodeId, messageBus, options = {}) {
    this.nodeId = nodeId
    this.messageBus = messageBus
    this.data = options.data || {}  // 노드가 보유한 데이터
    this.responseDelay = options.responseDelay || 0  // 응답 지연 시뮬레이션

    // 요청 리스너 설정
    this.messageBus.on('collector:request', (request) => {
      this._handleRequest(request)
    })
  }

  /**
   * 요청 처리
   * @param {Object} request - 수신된 요청
   * @private
   */
  async _handleRequest(request) {
    const { correlationId, data, replyTo } = request

    console.log(`[Node ${this.nodeId}] 요청 수신 (ID: ${correlationId})`)

    // 응답 지연 시뮬레이션
    if (this.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.responseDelay))
    }

    try {
      // 요청 데이터에 따라 응답 생성
      const responseData = this._processRequest(data)

      // 응답 전송
      this.messageBus.emit(replyTo, {
        correlationId,
        nodeId: this.nodeId,
        data: responseData,
        error: null
      })
    } catch (error) {
      // 에러 응답 전송
      this.messageBus.emit(replyTo, {
        correlationId,
        nodeId: this.nodeId,
        data: null,
        error: error.message
      })
    }
  }

  /**
   * 요청 데이터 처리
   * @param {Object} requestData - 요청 데이터
   * @returns {any} 응답 데이터
   * @private
   */
  _processRequest(requestData) {
    // 예: 상태 정보 요청
    if (requestData.type === 'status') {
      return {
        nodeId: this.nodeId,
        status: 'running',
        uptime: process.uptime(),
        data: this.data
      }
    }

    // 예: 특정 키 값 요청
    if (requestData.type === 'get' && requestData.key) {
      return {
        nodeId: this.nodeId,
        key: requestData.key,
        value: this.data[requestData.key]
      }
    }

    // 기본: 전체 데이터 반환
    return {
      nodeId: this.nodeId,
      data: this.data
    }
  }
}

// 예제 실행
async function main() {
  console.log('=== 연습문제 13.5: 데이터 수집기 패턴 ===\n')

  // 메시지 버스 (실제로는 Redis Pub/Sub, ZeroMQ 등)
  const messageBus = new EventEmitter()

  // 노드 생성 (각각 다른 데이터와 응답 지연)
  const nodes = [
    new DataNode('node-1', messageBus, {
      data: { cpu: 45, memory: 60 },
      responseDelay: 100
    }),
    new DataNode('node-2', messageBus, {
      data: { cpu: 80, memory: 75 },
      responseDelay: 200
    }),
    new DataNode('node-3', messageBus, {
      data: { cpu: 30, memory: 40 },
      responseDelay: 50
    })
  ]

  // 데이터 수집기 생성
  const collector = new DataCollector(messageBus, {
    timeout: 3000
  })

  console.log('노드 수:', nodes.length)
  console.log('')

  // 예제 1: 모든 노드의 상태 수집
  console.log('--- 예제 1: 상태 정보 수집 ---\n')

  const statusResult = await collector.collect(
    { type: 'status' },
    { expectedNodes: 3 }
  )

  console.log('\n수집 결과:')
  console.log(`- 총 응답 수: ${statusResult.totalCount}`)
  console.log(`- 전체 수신 완료: ${statusResult.allReceived}`)
  console.log('- 응답 데이터:')
  statusResult.responses.forEach((r) => {
    console.log(`  ${r.nodeId}: CPU ${r.data.data.cpu}%, Memory ${r.data.data.memory}%`)
  })

  console.log('\n--- 예제 2: 타임아웃으로 수집 완료 ---\n')

  // 예제 2: 짧은 타임아웃 (일부 응답만 수집)
  const partialResult = await collector.collect(
    { type: 'status' },
    { timeout: 150 }  // 150ms 타임아웃 - node-2는 응답 못함
  )

  console.log('\n수집 결과:')
  console.log(`- 총 응답 수: ${partialResult.totalCount}`)
  console.log(`- 전체 수신 완료: ${partialResult.allReceived}`)

  console.log('\n=== 완료 ===')
}

main().catch(console.error)

/*
핵심 포인트:
1. DataCollector는 게시/구독 패턴으로 모든 노드에 요청 브로드캐스트
2. 상관 식별자(correlationId)로 요청-응답 매칭
3. 두 가지 완료 조건:
   - 예상 노드 수만큼 응답 수신 (expectedNodes)
   - 타임아웃 발생 (timeout)
4. DataNode는 요청을 수신하고 replyTo 채널로 응답
5. 집계 결과에는 모든 응답 + 메타데이터 포함
*/
