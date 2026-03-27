/**
 * 04-db-preinitialization-queue.js
 * 사전 초기화 큐 방식
 *
 * 초기화 전 요청을 큐에 저장하고, 초기화 완료 후 일괄 실행
 */

import { EventEmitter } from 'events'

class DB extends EventEmitter {
  connected = false
  commandsQueue = []

  connect() {
    console.log('Connecting to database...')
    setTimeout(() => {
      this.connected = true
      console.log('Database connected!')
      this.emit('connected')

      // 큐에 쌓인 명령들 실행
      this.commandsQueue.forEach(command => command())
      this.commandsQueue = []
    }, 500)
  }

  async query(queryString) {
    if (!this.connected) {
      console.log(`Request queued: ${queryString}`)

      // 명령을 큐에 저장하고 Promise 반환
      return new Promise((resolve, reject) => {
        const command = () => {
          this.query(queryString)
            .then(resolve, reject)
        }
        this.commandsQueue.push(command)
      })
    }

    console.log(`Query executed: ${queryString}`)
    return { rows: [] }
  }
}

export const db = new DB()

async function main() {
  db.connect()

  // 연결 전 호출 - 큐에 저장됨
  const promise1 = db.query('SELECT * FROM users')
  const promise2 = db.query('SELECT * FROM orders')

  // 연결 완료 후 자동 실행
  const results = await Promise.all([promise1, promise2])
  console.log('All queries completed!')

  // 이후 호출 - 바로 실행
  setTimeout(async () => {
    await db.query('SELECT * FROM products')
  }, 600)
}

main()

/**
 * 장점:
 * - 사용자 코드에서 초기화 상태 확인 불필요
 * - 투명한 사용 가능 (초기화 상태를 몰라도 됨)
 *
 * 이 방식이 Mongoose, pg 등에서 사용됨
 */
