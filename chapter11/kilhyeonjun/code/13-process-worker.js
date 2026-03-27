/**
 * 13-process-worker.js
 * 프로세스 풀의 워커 스크립트
 *
 * 부분집합 합계 문제를 계산하는 워커
 */

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
process.on('message', (msg) => {
  if (msg.type === 'task') {
    const { set, sum } = msg.data
    const startTime = Date.now()

    try {
      const results = subsetSum(set, sum)
      const duration = Date.now() - startTime

      process.send({
        type: 'result',
        data: {
          count: results.length,
          duration,
          sample: results.slice(0, 3)
        }
      })
    } catch (error) {
      process.send({
        type: 'result',
        error: error.message
      })
    }
  } else if (msg.type === 'shutdown') {
    process.exit(0)
  }
})

console.log(`[Worker ${process.pid}] Ready`)
