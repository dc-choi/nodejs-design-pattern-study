/**
 * Chapter 13: 요청/응답 패턴 - child_process 예제
 *
 * child_process.fork()를 사용하여 부모-자식 프로세스 간
 * 요청/응답 통신을 구현합니다.
 *
 * 이 예제는 단일 파일로 작성되어 있어 requestor와 replier 역할을
 * 모두 시뮬레이션합니다.
 */

import { fork } from 'child_process'
import { fileURLToPath } from 'url'

// nanoid 대신 간단한 ID 생성 함수
function generateId() {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * 요청 채널 생성 함수
 * 주어진 채널(process 또는 child)을 감싸서 요청/응답 추상화를 제공합니다.
 */
function createRequestChannel(channel) {
  const correlationMap = new Map()

  function sendRequest(data) {
    console.log('[Requestor] Sending request:', data)

    return new Promise((resolve, reject) => {
      const correlationId = generateId()

      // 10초 타임아웃
      const replyTimeout = setTimeout(() => {
        correlationMap.delete(correlationId)
        reject(new Error('Request timeout'))
      }, 10000)

      // 응답 핸들러 등록
      correlationMap.set(correlationId, (replyData) => {
        correlationMap.delete(correlationId)
        clearTimeout(replyTimeout)
        resolve(replyData)
      })

      // 요청 전송
      channel.send({
        type: 'request',
        data,
        id: correlationId
      })
    })
  }

  // 응답 수신 리스너
  channel.on('message', (message) => {
    if (message.type === 'response') {
      const callback = correlationMap.get(message.inReplyTo)
      if (callback) {
        callback(message.data)
      }
    }
  })

  return sendRequest
}

/**
 * 응답 채널 생성 함수
 * 요청을 수신하고 핸들러를 실행한 후 응답을 전송합니다.
 */
function createReplyChannel(channel) {
  return function registerHandler(handler) {
    channel.on('message', async (message) => {
      if (message.type !== 'request') {
        return
      }

      console.log('[Replier] Received request:', message.data)

      // 핸들러 실행
      const replyData = await handler(message.data)

      console.log('[Replier] Sending response:', replyData)

      // 응답 전송
      channel.send({
        type: 'response',
        data: replyData,
        inReplyTo: message.id
      })
    })
  }
}

// 자식 프로세스로 실행될 때 (CHILD_PROCESS 환경변수로 판단)
if (process.env.CHILD_PROCESS === 'true') {
  console.log('[Replier] Child process started')

  const registerReplyHandler = createReplyChannel(process)

  // 요청 핸들러: 두 숫자의 합계 계산 (지연 시뮬레이션)
  registerReplyHandler((req) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ sum: req.a + req.b })
      }, req.delay || 100)
    })
  })

  // 준비 완료 알림
  process.send({ type: 'ready' })
}
// 부모 프로세스로 실행될 때
else {
  async function main() {
    const __filename = fileURLToPath(import.meta.url)

    console.log('[Requestor] Starting child process...')

    // 자식 프로세스 생성 (같은 파일을 CHILD_PROCESS=true로 실행)
    const child = fork(__filename, [], {
      env: { ...process.env, CHILD_PROCESS: 'true' }
    })

    const request = createRequestChannel(child)

    // 자식 프로세스 준비 대기
    await new Promise((resolve) => {
      child.once('message', (msg) => {
        if (msg.type === 'ready') {
          console.log('[Requestor] Child process is ready')
          resolve()
        }
      })
    })

    try {
      // 두 개의 요청을 병렬로 전송
      // 첫 번째 요청은 500ms 지연, 두 번째는 100ms 지연
      // 응답은 보낸 순서와 다르게 도착할 수 있음
      const p1 = request({ a: 1, b: 2, delay: 500 })
        .then((res) => {
          console.log(`[Requestor] Reply: 1 + 2 = ${res.sum}`)
          return res
        })

      const p2 = request({ a: 6, b: 1, delay: 100 })
        .then((res) => {
          console.log(`[Requestor] Reply: 6 + 1 = ${res.sum}`)
          return res
        })

      await Promise.all([p1, p2])

      console.log('[Requestor] All requests completed')
    } finally {
      // 자식 프로세스 종료
      child.disconnect()
      console.log('[Requestor] Child process disconnected')
    }
  }

  main().catch((err) => console.error(err))
}
