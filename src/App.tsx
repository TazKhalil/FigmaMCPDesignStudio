import React, { Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'

// Lazy-loaded RF Planner feature chunk (Phase 9 will flesh this out)
const RFPlannerPage = React.lazy(
  () => import('./features/rf-planner/pages/RFPlannerPage'),
)

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>}>
        <RFPlannerPage />
      </Suspense>
    ),
  },
])

export default function App() {
  return (
    <ErrorBoundary label="App">
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}
