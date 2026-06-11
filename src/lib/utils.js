export function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function pickByDifficulty(questions, { beginner, intermediate, expert }) {
  const total = beginner + intermediate + expert
  const b = shuffle(questions.filter(q => q.difficulty === 'Beginner')).slice(0, beginner)
  const i = shuffle(questions.filter(q => q.difficulty === 'Intermediate')).slice(0, intermediate)
  const e = shuffle(questions.filter(q => q.difficulty === 'Expert')).slice(0, expert)
  let picked = [...b, ...i, ...e]
  if (picked.length < total) {
    const used = new Set(picked)
    const rest = shuffle(questions.filter(q => !used.has(q)))
    picked = [...picked, ...rest.slice(0, total - picked.length)]
  }
  return shuffle(picked)
}

export function getLetters() {
  return ['A', 'B', 'C', 'D']
}

export function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
