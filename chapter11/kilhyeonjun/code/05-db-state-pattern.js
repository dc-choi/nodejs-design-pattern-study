/**
 * 05-db-state-pattern.js
 * 상태 패턴을 활용한 사전 초기화 큐
 *
 * QueuingState와 InitializedState로 분리하여 더 깔끔하게 구현
 */

import { EventEmitter } from 'events'

// 초기화가 필요한 함수 목록
const METHODS_REQUIRING_CONNECTION = ['query']

// 상태 비활성화를 위한 Symbol (이름 충돌 방지)
const deactivate = Symbol('deactivate')

// 대기 상태: 초기화 전
class QueuingState {
  constructor(db) {
    this.db = db
    this.commandsQueue = []

    // 연결이 필요한 함수들을 동적으로 생성
    METHODS_REQUIRING_CONNECTION.forEach(methodName => {
      this[methodName] = function (...args) {
        console.log('Command queued:', methodName, args[0])
        return new Promise((resolve, reject) => {
          const command = () => {
            db[methodName](...args)
              .then(resolve, reject)
          }
          this.commandsQueue.push(command)
        })
      }
    })
  }

  // 상태 비활성화 시 큐 실행
  [deactivate]() {
    console.log('Flushing queued commands...')
    this.commandsQueue.forEach(command => command())
    this.commandsQueue = []
  }
}

// 초기화 완료 상태: 비즈니스 로직만 구현
class InitializedState {
  async query(queryString) {
    console.log(`Query executed: ${queryString}`)
    return { rows: [] }
  }
}

// DB 컨텍스트 클래스
class DB extends EventEmitter {
  constructor() {
    super()
    this.state = new QueuingState(this)
  }

  // 현재 상태로 위임
  async query(queryString) {
    return this.state.query(queryString)
  }

  connect() {
    console.log('Connecting to database...')
    setTimeout(() => {
      console.log('Database connected!')
      this.emit('connected')

      // 상태 전환
      const oldState = this.state
      this.state = new InitializedState()

      // 이전 상태 비활성화 (큐 실행)
      if (oldState[deactivate]) {
        oldState[deactivate]()
      }
    }, 500)
  }
}

export const db = new DB()

async function main() {
  db.connect()

  // 연결 전 호출 - QueuingState가 처리
  const promise1 = db.query('SELECT * FROM users')
  const promise2 = db.query('SELECT * FROM orders')

  const results = await Promise.all([promise1, promise2])
  console.log('All queries completed!')

  // 연결 후 호출 - InitializedState가 처리
  setTimeout(async () => {
    await db.query('SELECT * FROM products')
  }, 600)
}

main()

/**
 * 장점:
 * - 상태별 로직 분리로 코드 가독성 향상
 * - InitializedState는 순수 비즈니스 로직만 포함
 * - 확장이 용이 (새로운 상태 추가 가능)
 */
