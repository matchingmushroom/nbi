import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import ModeratorRoute from './components/ModeratorRoute'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import QuizSelectPage from './pages/QuizSelectPage'
import ChapterQuizPage from './pages/ChapterQuizPage'
import ModuleQuizPage from './pages/ModuleQuizPage'
import ModeQuizPage from './pages/ModeQuizPage'
import FinalQuizPage from './pages/FinalQuizPage'
import PreAssessmentPage from './pages/PreAssessmentPage'
import MockTestQuizPage from './pages/MockTestQuizPage'
import ResultsPage from './pages/ResultsPage'
import ResultDetailPage from './pages/ResultDetailPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import SimpleLearnPage from './pages/SimpleLearnPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminQuestionsPage from './pages/AdminQuestionsPage'
import AdminAnalyticsPage from './pages/AdminAnalyticsPage'
import AdminCoursesPage from './pages/AdminCoursesPage'
import AdminCourseUploadPage from './pages/AdminCourseUploadPage'
import AdminSettingsPage from './pages/AdminSettingsPage'

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="h-dvh flex flex-col bg-background font-['Inter']">
                  <Navbar />
                  <div className="flex-1 min-h-0 overflow-hidden md:ml-64 pb-14 md:pb-0">
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/quiz/select" element={<QuizSelectPage />} />
                      <Route path="/quiz/chapter/:chapterName" element={<ChapterQuizPage />} />
                      <Route path="/quiz/module/:moduleName" element={<ModuleQuizPage />} />
                      <Route path="/quiz/mode/:modeName" element={<ModeQuizPage />} />
                      <Route path="/quiz/final" element={<FinalQuizPage />} />
                      <Route path="/quiz/pre-assessment" element={<PreAssessmentPage />} />
                      <Route path="/quiz/mock-test" element={<MockTestQuizPage />} />
                      <Route path="/results" element={<ResultsPage />} />
                      <Route path="/results/:id" element={<ResultDetailPage />} />
                      <Route path="/mylearn" element={<SimpleLearnPage />} />
                      <Route path="/leaderboard" element={<LeaderboardPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                      <Route path="/admin/questions" element={<ModeratorRoute><AdminQuestionsPage /></ModeratorRoute>} />
                      <Route path="/admin/courses" element={<ModeratorRoute><AdminCoursesPage /></ModeratorRoute>} />
                      <Route path="/admin/upload-course" element={<AdminRoute><AdminCourseUploadPage /></AdminRoute>} />
                      <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
                      <Route path="/admin/analytics" element={<AdminRoute><AdminAnalyticsPage /></AdminRoute>} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}

export default App
