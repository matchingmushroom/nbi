export const DAILY_MISSIONS = [
  { id: 'take_quiz', name: 'Quiz Taker', icon: 'play_lesson', desc: 'Complete 1 quiz today' },
  { id: 'high_scorer', name: 'Top Scorer', icon: 'stars', desc: 'Score 80%+ on any quiz today' },
  { id: 'speed_runner', name: 'Speed Runner', icon: 'bolt', desc: 'Finish a quiz in under 5 min today' },
  { id: 'streak_master', name: 'Streak Master', icon: 'local_fire_department', desc: 'Get 3+ consecutive correct in one quiz today' },
]

export function checkDailyMission(missionId, todayResults) {
  switch (missionId) {
    case 'take_quiz':
      return todayResults.length >= 1
    case 'high_scorer':
      return todayResults.some(r => r.percentage >= 80)
    case 'speed_runner':
      return todayResults.some(r => r.timeTaken && r.timeTaken < 300)
    case 'streak_master':
      return todayResults.some(r => {
        if (!r.answers) return false
        let streak = 0
        for (const a of r.answers) {
          if (a.isCorrect) {
            streak++
            if (streak >= 3) return true
          } else {
            streak = 0
          }
        }
        return false
      })
    default:
      return false
  }
}
