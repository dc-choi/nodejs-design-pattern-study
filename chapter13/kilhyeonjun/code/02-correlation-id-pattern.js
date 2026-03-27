/**
 * Chapter 13: 상관 식별자(Correlation ID) 패턴
 *
 * 비동기 채널에서 요청과 응답을 매칭시키는 핵심 패턴입니다.
 * EventEmitter를 사용하여 채널을 시뮬레이션합니다.
 */

import { EventEmitter } from 'events'

// 간단한 ID 생성 함수
function generateId() {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * 상관 식별자 패턴을 구현한 요청/응답 추상화
 *
 * 이 클래스는 비동기 채널 위에 동기식 요청/응답 통신을 추상화합니다.
 */
class CorrelationChannel {
  constructor() {
    // 상관관계 맵: correlationId -> { resolve, reject, timeout }
    this.correlationMap = new Map()

    // 시뮬레이션용 채널 (실제로는 WebSocket, child_process 등)
    this.channel = new EventEmitter()

    // 응답 수신 리스너 설정
    this.channel.on('response', (message) => {
      this._handleResponse(message)
    })
  }

  /**
   * 요청 전송
   * @param {any} data - 요청 데이터
   * @param {number} timeout - 타임아웃 (ms)
   * @returns {Promise<any>} 응답 데이터
   */
  sendRequest(data, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const correlationId = generateId()

      console.log(`[Request] ID: ${correlationId}, Data:`, data)

      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        this.correlationMap.delete(correlationId)
        reject(new Error(`Request timeout: ${correlationId}`))
      }, timeout)

      // 상관관계 맵에 저장
      this.correlationMap.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutId
      })

      // 요청 이벤트 발생
      this.channel.emit('request', {
        id: correlationId,
        data
      })
    })
  }

  /**
   * 응답 핸들러 등록
   * @param {Function} handler - 요청을 처리하고 응답 데이터를 반환하는 함수
   */
  registerHandler(handler) {
    this.channel.on('request', async (message) => {
      console.log(`[Handler] Processing request ID: ${message.id}`)

      try {
        // 핸들러 실행
        const responseData = await handler(message.data)

        // 응답 전송
        this.channel.emit('response', {
          inReplyTo: message.id,
          data: responseData
        })
      } catch (error) {
        // 에러 응답 전송
        this.channel.emit('response', {
          inReplyTo: message.id,
          error: error.message
        })
      }
    })
  }

  /**
   * 응답 처리
   * @private
   */
  _handleResponse(message) {
    const pending = this.correlationMap.get(message.inReplyTo)

    if (!pending) {
      console.log(`[Response] Unknown correlation ID: ${message.inReplyTo}`)
      return
    }

    // 정리
    this.correlationMap.delete(message.inReplyTo)
    clearTimeout(pending.timeout)

    console.log(`[Response] ID: ${message.inReplyTo}, Data:`, message.data)

    // 에러 또는 성공 처리
    if (message.error) {
      pending.reject(new Error(message.error))
    } else {
      pending.resolve(message.data)
    }
  }
}

// 예제 실행
async function main() {
  const channel = new CorrelationChannel()

  // 핸들러 등록: 두 숫자의 합계 계산 (비동기 지연 시뮬레이션)
  channel.registerHandler(async (data) => {
    // 요청별 다른 지연 시간 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, data.delay || 100))
    return { sum: data.a + data.b }
  })

  console.log('=== 상관 식별자 패턴 데모 ===\n')

  // 여러 요청을 병렬로 전송
  // 응답 순서가 요청 순서와 다를 수 있음을 보여줍니다
  const requests = [
    channel.sendRequest({ a: 1, b: 2, delay: 300 }),  // 느린 요청
    channel.sendRequest({ a: 3, b: 4, delay: 100 }),  // 빠른 요청
    channel.sendRequest({ a: 5, b: 6, delay: 200 })   // 중간 속도
  ]

  console.log('\n=== 요청 전송 완료, 응답 대기 중... ===\n')

  const results = await Promise.all(requests)

  console.log('\n=== 모든 응답 수신 완료 ===')
  console.log('Results:', results)

  // 응답 순서 확인
  // 빠른 요청(3+4)이 먼저 응답하고, 느린 요청(1+2)이 마지막에 응답
  // 하지만 Promise.all의 결과는 요청 순서를 유지
}

main().catch(console.error)

/*
예상 출력:
=== 상관 식별자 패턴 데모 ===

[Request] ID: abc123, Data: { a: 1, b: 2, delay: 300 }
[Handler] Processing request ID: abc123
[Request] ID: def456, Data: { a: 3, b: 4, delay: 100 }
[Handler] Processing request ID: def456
[Request] ID: ghi789, Data: { a: 5, b: 6, delay: 200 }
[Handler] Processing request ID: ghi789

=== 요청 전송 완료, 응답 대기 중... ===

[Response] ID: def456, Data: { sum: 7 }      <- 빠른 요청이 먼저 응답
[Response] ID: ghi789, Data: { sum: 11 }     <- 중간 속도
[Response] ID: abc123, Data: { sum: 3 }      <- 느린 요청이 마지막

=== 모든 응답 수신 완료 ===
Results: [{ sum: 3 }, { sum: 7 }, { sum: 11 }]
*/
