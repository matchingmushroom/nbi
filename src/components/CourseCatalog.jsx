export default function CourseCatalog({ courses, enrolledCourses, onEnroll, onEnter }) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="font-['Hanken_Grotesk'] text-2xl font-bold text-on-surface">Learning Center</h1>
        <p className="text-on-surface-variant text-sm mt-1">Pick a course and build your daily learning streak</p>
      </div>

      {courses.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] mb-3">school</span>
          <p className="text-sm font-medium">No courses available yet.</p>
          <p className="text-xs mt-1">Courses will appear here once uploaded by an admin.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {courses.map((c) => {
          const enrolled = enrolledCourses?.[c.courseId]
          const progress = enrolled?.completedDays?.length || 0
          const steak = enrolled?.currentSteak || 0
          return (
            <div key={c.courseId} className="bg-surface border border-outline-variant rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[22px]">menu_book</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-['Hanken_Grotesk'] text-base font-bold text-on-surface truncate">{c.courseTitle}</h3>
                  <p className="text-[11px] text-on-surface-variant">{c.dayCount} days · {c.courseId}</p>
                </div>
              </div>
              {enrolled ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-on-surface-variant">Progress:</span>
                    <div className="flex-1 h-1.5 bg-surface-container-low rounded-full overflow-hidden max-w-[120px]">
                      <div className="h-full bg-secondary rounded-full" style={{ width: `${(progress / c.dayCount) * 100}%` }} />
                    </div>
                    <span className="font-medium text-on-surface">{progress}/{c.dayCount}</span>
                  </div>
                  {steak > 0 && (
                    <div className="flex items-center gap-1 text-orange-500 text-xs">
                      <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                      <span className="font-bold">{steak} day streak</span>
                    </div>
                  )}
                  <button
                    onClick={() => onEnter(c.courseId)}
                    className="w-full mt-2 bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Continue Learning
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onEnroll(c.courseId)}
                  className="w-full bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Enroll
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
