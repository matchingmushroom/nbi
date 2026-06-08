import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownRenderer({ content }) {
  const [expandedId, setExpandedId] = useState(null)

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  if (!content) return null

  const components = {
    h1: ({ children }) => (
      <h1 className="font-['Hanken_Grotesk'] text-xl font-bold text-on-surface mt-6 mb-3 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-['Hanken_Grotesk'] text-lg font-bold text-on-surface mt-5 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-['Hanken_Grotesk'] text-base font-bold text-on-surface mt-4 mb-2 first:mt-0">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-sm text-on-surface leading-relaxed mb-3 last:mb-0">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-on-surface">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-on-surface">{children}</em>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-5 mb-3 space-y-1 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 mb-3 space-y-1 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-sm text-on-surface leading-relaxed">{children}</li>
    ),
    code: ({ children, inline }) => (
      inline
        ? <code className="bg-surface-container-high text-primary px-1 py-0.5 rounded text-xs font-mono">{children}</code>
        : <pre className="bg-surface-container-high text-on-surface p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed mb-3 last:mb-0"><code>{children}</code></pre>
    ),
    pre: ({ children }) => <>{children}</>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary/40 pl-4 py-1 mb-3 text-sm text-on-surface-variant italic last:mb-0">{children}</blockquote>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">{children}</a>
    ),
    hr: () => <hr className="border-t border-outline-variant my-4 last:mb-0" />,
    table: ({ children }) => (
      <div className="overflow-x-auto mb-3 last:mb-0">
        <table className="w-full text-xs border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-surface-container-low">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody>{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-outline-variant">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-semibold text-on-surface text-xs">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-on-surface-variant">{children}</td>
    ),
    details: ({ children }) => <>{children}</>,
    summary: ({ children }) => <>{children}</>,
  }

  const rawComponents = {
    details: ({ children, ...props }) => {
      const id = Math.random().toString(36).slice(2, 9)
      const isOpen = expandedId === id
      const childArray = children
      const summaryEl = childArray?.find(c => c?.type === 'summary')
      const rest = childArray?.filter(c => c?.type !== 'summary')
      return (
        <div className="mb-3 last:mb-0">
          <button
            onClick={() => toggleExpand(id)}
            className="w-full flex items-center gap-2 text-sm font-semibold text-on-surface bg-surface-container-low px-3 py-2 rounded-xl hover:bg-surface-container-high transition-all cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              chevron_right
            </span>
            {summaryEl?.props?.children}
          </button>
          {isOpen && (
            <div className="mt-2 pl-2">
              {rest}
            </div>
          )}
          {isOpen && !rest?.length && (
            <div className="mt-2 pl-2 text-sm text-on-surface-variant">No additional content</div>
          )}
        </div>
      )
    },
    summary: () => null,
  }

  return (
    <div className="markdown-content leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ ...components, ...rawComponents }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
